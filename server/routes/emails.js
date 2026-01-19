const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  fetchStarredEmails,
  saveEmailsToDatabase,
  getStoredEmails,
  getStoredEmailsCount,
  getEmailById,
  deleteEmail,
  fetchEmailBodiesInParallel,
  updateEmailBodies,
  fetchFullEmailByUid
} = require('../services/emailService');

// ⚡ SYNC LOCK: Prevent concurrent syncs per workspace
const syncLocks = new Map(); // workspaceId -> { inProgress: boolean, lastSync: Date }
const SYNC_COOLDOWN_MS = 30000; // 30 seconds minimum between syncs

// ─────────────────────────────────────────────
// SYNC EMAILS – FAST + BODY PREFETCH
// ─────────────────────────────────────────────
router.post(
  '/sync',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      if (!req.user.workspace) {
        return res.status(400).json({ message: 'Workspace required' });
      }

      const workspaceId = req.user.workspace._id.toString();

      // ⚡ CHECK SYNC LOCK: Prevent concurrent syncs and too-frequent syncs
      const lockState = syncLocks.get(workspaceId) || { inProgress: false, lastSync: null };

      if (lockState.inProgress) {
        console.log(`⏳ Sync already in progress for workspace ${workspaceId}, skipping`);
        return res.json({ message: 'Sync already in progress', emailsFetched: 0, ticketsCreated: 0, cached: true });
      }

      if (lockState.lastSync && (Date.now() - lockState.lastSync.getTime()) < SYNC_COOLDOWN_MS) {
        console.log(`⏳ Sync cooldown active for workspace ${workspaceId}, skipping`);
        return res.json({ message: 'Sync completed recently', emailsFetched: 0, ticketsCreated: 0, cached: true });
      }

      // Set lock
      syncLocks.set(workspaceId, { inProgress: true, lastSync: lockState.lastSync });

      const email = process.env.EMAIL_USER;
      const password = process.env.EMAIL_PASSWORD;
      if (!email || !password) {
        syncLocks.set(workspaceId, { inProgress: false, lastSync: lockState.lastSync });
        return res.status(500).json({ message: 'Email credentials missing' });
      }

      // 1️⃣ FETCH STARRED EMAIL HEADERS (fast)
      const emails = await fetchStarredEmails(
        email,
        password,
        req.user.workspace._id,
        req.user._id
      );

      // 2️⃣ SAVE HEADERS FIRST (instant response)
      await saveEmailsToDatabase(emails, req.user.workspace._id);

      // 3️⃣ CREATE TICKETS (optimized with batch queries)
      let createdTickets = [];
      try {
        const Ticket = require('../models/Ticket');
        const Email = require('../models/Email');

        if (emails.length > 0) {
          // ⚡ BATCH QUERY 1: Get all existing tickets in ONE query
          const messageIds = emails.map(e => e.messageId).filter(Boolean);
          const threadIds = emails.map(e => e.threadId).filter(Boolean);

          const existingTickets = await Ticket.find({
            workspace: req.user.workspace._id,
            $or: [
              { messageId: { $in: messageIds } },
              { threadId: { $in: threadIds } }
            ]
          }).select('messageId threadId').lean();

          const existingMessageIds = new Set(existingTickets.map(t => t.messageId));
          const existingThreadIds = new Set(existingTickets.map(t => t.threadId));

          // ⚡ BATCH QUERY 2: Get all email docs in ONE query
          const emailDocs = await Email.find({
            messageId: { $in: messageIds },
            workspace: req.user.workspace._id
          }).lean();

          const emailDocMap = {};
          emailDocs.forEach(e => { emailDocMap[e.messageId] = e; });

          // Filter emails that need tickets
          const emailsNeedingTickets = emails.filter(e => {
            if (existingMessageIds.has(e.messageId) || existingThreadIds.has(e.threadId)) return false;
            const emailDoc = emailDocMap[e.messageId];
            if (emailDoc && emailDoc.jobId) return false; // Already linked
            return true;
          });

          if (emailsNeedingTickets.length > 0) {
            // Prepare ticket data in bulk
            const ticketsToCreate = emailsNeedingTickets.map(e => {
              const emailDoc = emailDocMap[e.messageId];
              const ticketData = {
                jobId: 'JOB-' + Math.floor(100000 + Math.random() * 900000),
                consultantName: 'Auto-generated',
                clientName: e.from.name || e.from.address,
                clientEmail: e.from.address,
                subject: e.subject || '(No Subject)',
                status: 'not_assigned',
                createdBy: req.user.email,
                workspace: req.user.workspace._id,
                messageId: e.messageId,
                threadId: e.threadId,
                emailUid: e.uid,
                createdAt: e.date || new Date()
              };

              if (emailDoc && emailDoc.body) {
                ticketData.emailBodyHtml = emailDoc.body.html || '';
                ticketData.emailBodyText = emailDoc.body.text || '';
                ticketData.message = emailDoc.body.text || emailDoc.body.html || '';
                ticketData.attachments = emailDoc.attachments || [];
                ticketData.hasAttachments = (emailDoc.attachments || []).length > 0;
              }

              return ticketData;
            });

            // ⚡ BATCH INSERT: Create all tickets at once
            createdTickets = await Ticket.insertMany(ticketsToCreate, { ordered: false });

            // ⚡ BATCH UPDATE: Link all emails to tickets in ONE operation
            const emailUpdateOps = createdTickets.map(t => ({
              updateOne: {
                filter: { messageId: t.messageId, workspace: req.user.workspace._id },
                update: { $set: { jobId: t.jobId, isStarred: false } }
              }
            }));

            if (emailUpdateOps.length > 0) {
              await Email.bulkWrite(emailUpdateOps, { ordered: false });
            }

            console.log(`✅ Created ${createdTickets.length} tickets (batch mode)`);
          }
        }
      } catch (err) {
        console.error('⚠️ Ticket creation failed:', err.message);
      }

      // ⚡ RELEASE LOCK and update lastSync timestamp
      syncLocks.set(workspaceId, { inProgress: false, lastSync: new Date() });

      // ⚡ RESPOND NOW - Tickets are created, frontend can fetch them immediately!
      res.json({
        message: 'Sync completed',
        emailsFetched: emails.length,
        ticketsCreated: createdTickets.length
      });

      // 4️⃣ BACKGROUND PROCESSING: Fetch email bodies (non-blocking, user doesn't wait)
      setImmediate(async () => {
        try {
          const Ticket = require('../models/Ticket');
          const Email = require('../models/Email');

          // ⚡ OPTIMIZED QUERY: Use indexed field instead of slow $or
          // Find emails that need bodies - uses compound index {workspace, isStarred, uid}
          const emailsNeedingBodies = await Email.find({
            workspace: req.user.workspace._id,
            isStarred: true,
            uid: { $ne: null },
            'body.html': { $in: [null, ''] } // Simpler query, uses index
          }).select('_id uid messageId').limit(100).lean();

          if (emailsNeedingBodies.length > 0) {
            console.log(`⚡ BACKGROUND: Fetching ${emailsNeedingBodies.length} email bodies in parallel...`);
            const startTime = Date.now();

            // Fetch with concurrency limit
            const fetchResults = await fetchEmailBodiesInParallel(
              email,
              password,
              emailsNeedingBodies,
              15 // Balanced concurrency - fast but won't overwhelm IMAP
            );

            const successResults = fetchResults.filter(r => r.success && r.body);
            const duration = Date.now() - startTime;

            // Update Email collection
            await updateEmailBodies(fetchResults);

            // ⚡ BATCH UPDATE: Get all messageIds at once, then do single bulkWrite
            if (successResults.length > 0) {
              console.log(`⚡ Batch updating ${successResults.length} tickets...`);

              // Get all email docs in ONE query instead of N queries
              const emailIds = successResults.map(r => r.emailId);
              const emailDocs = await Email.find({ _id: { $in: emailIds } })
                .select('_id messageId')
                .lean();

              // Create map for fast lookup
              const emailIdToMessageId = {};
              emailDocs.forEach(e => { emailIdToMessageId[e._id.toString()] = e.messageId; });

              // Build bulk operations
              const bulkOps = successResults
                .filter(r => emailIdToMessageId[r.emailId.toString()])
                .map(result => ({
                  updateMany: {
                    filter: { messageId: emailIdToMessageId[result.emailId.toString()] },
                    update: {
                      $set: {
                        emailBodyHtml: result.body.html || '',
                        emailBodyText: result.body.text || '',
                        message: result.body.text || result.body.html || '',
                        attachments: result.attachments || [],
                        hasAttachments: (result.attachments || []).length > 0
                      }
                    }
                  }
                }));

              if (bulkOps.length > 0) {
                await Ticket.bulkWrite(bulkOps, { ordered: false });
              }

              console.log(`✅ BACKGROUND COMPLETE: Cached ${successResults.length}/${emailsNeedingBodies.length} bodies in ${duration}ms`);
            }
          } else {
            console.log(`✓ All email bodies already cached`);
          }
        } catch (err) {
          console.error('⚠️ Background processing failed:', err.message);
        }
      });
    } catch (err) {
      // Release lock on error
      const workspaceId = req.user?.workspace?._id?.toString();
      if (workspaceId) {
        syncLocks.set(workspaceId, { inProgress: false, lastSync: null });
      }
      console.error('Sync failed:', err);
      res.status(500).json({ message: 'Sync failed', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// GET ALL EMAILS (metadata only, fast with pagination)
// ─────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 50;
      const skip = page * limit;

      const [emails, total] = await Promise.all([
        getStoredEmails(req.user.workspace._id, limit, skip),
        getStoredEmailsCount(req.user.workspace._id)
      ]);

      res.json({ 
        emails,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      console.error('Error fetching emails:', err);
      res.status(500).json({ message: 'Failed to fetch emails', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// GET SINGLE EMAIL – INSTANT (DB only, no waiting for IMAP)
// ─────────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const email = await getEmailById(req.params.id);
      if (!email) return res.status(404).json({ message: 'Email not found' });

      // ⚡ INSTANT: Return immediately with whatever we have (cached body or metadata)
      // No waiting for IMAP - user sees email instantly
      console.log(`✅ INSTANT: Returning email ${req.params.id}, has body: ${!!email.body?.html}, has UID: ${!!email.uid}`);
      res.json({ email });
      
      // 🔄 BACKGROUND: If body is missing, fetch it asynchronously (non-blocking)
      if (email.uid && (!email.body || !email.body.html)) {
        setImmediate(async () => {
          try {
            console.log(`⚡ BACKGROUND FETCH: Starting fetch for email ${req.params.id} with UID ${email.uid}`);
            const { fetchFullEmailByUid } = require('../services/emailService');

            // Try to fetch with a 12-second timeout (increased for reliability)
            const fullData = await Promise.race([
              fetchFullEmailByUid(
                process.env.EMAIL_USER,
                process.env.EMAIL_PASSWORD,
                email.uid
              ),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout after 12s')), 12000)
              )
            ]);

            const Email = require('../models/Email');
            await Email.findByIdAndUpdate(req.params.id, {
              body: fullData.body,
              attachments: fullData.attachments,
              hasAttachments: fullData.attachments?.length > 0
            });

            console.log(`✅ BACKGROUND: Successfully cached body for email ${req.params.id}`);
          } catch (err) {
            console.error(`⚠️ BACKGROUND fetch failed for ${req.params.id} with UID ${email.uid}:`, err.message);
            // Silently fail - user already has metadata
          }
        });
      } else if (!email.uid) {
        console.log(`ℹ️ Email ${req.params.id} has no UID, cannot fetch body from IMAP`);
      } else {
        console.log(`ℹ️ Email ${req.params.id} already has cached body`);
      }
    } catch (err) {
      console.error('Error fetching email:', err);
      res.status(500).json({ message: 'Failed to fetch email', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// DOWNLOAD ATTACHMENT – FAST
// ─────────────────────────────────────────────
router.get(
  '/:emailId/attachments/:index',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const email = await getEmailById(req.params.emailId);
      if (!email) return res.status(404).json({ message: 'Email not found' });

      // Fetch full email if attachments missing
      if (email.hasAttachments && (!email.attachments || !email.attachments.length)) {
        const full = await fetchFullEmailByUid(
          process.env.EMAIL_USER,
          process.env.EMAIL_PASSWORD,
          email.uid
        );

        const Email = require('../models/Email');
        await Email.findByIdAndUpdate(email._id, {
          body: full.body,
          attachments: full.attachments,
          hasAttachments: true
        });

        email.attachments = full.attachments;
      }

      const attachment = email.attachments[parseInt(req.params.index)];
      if (!attachment) return res.status(404).json({ message: 'Attachment not found' });

      const buffer = Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(attachment.content.data || attachment.content, 'base64');

      res.setHeader('Content-Type', attachment.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(attachment.filename)}"`
      );
      res.send(buffer);
    } catch (err) {
      console.error('Attachment download failed:', err);
      res.status(500).json({ message: 'Failed to download attachment', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// DELETE EMAIL
// ─────────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      await deleteEmail(req.params.id);
      res.json({ message: 'Email deleted successfully' });
    } catch (err) {
      console.error('Delete failed:', err);
      res.status(500).json({ message: 'Failed to delete email', error: err.message });
    }
  }
);

module.exports = router;
