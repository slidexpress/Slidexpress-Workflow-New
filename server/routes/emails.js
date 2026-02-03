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
  fetchFullEmailByUid
} = require('../services/emailService');

const Ticket = require('../models/Ticket');
const Email = require('../models/Email');
const { findClientsByEmails, getClientName } = require('../models/Client');
const { getNextJobId } = require('../models/JobCounter');

// Sync lock per workspace
const syncLocks = new Map();
const SYNC_COOLDOWN_MS = 15000;

// Helper to clean up email sender names (remove email part, quotes, etc.)
const cleanName = (name) => {
  if (!name) return '';
  let cleaned = name.replace(/['"]/g, '').trim();
  cleaned = cleaned.replace(/<[^>]*>?.*$/, '').trim();
  cleaned = cleaned.replace(/\s*\(via\s+Google.*\)$/i, '').trim();
  return cleaned;
};

// Extract company name from email domain
const getCompanyFromDomain = (email) => {
  if (!email) return 'Unknown';
  const domain = email.split('@')[1];
  if (!domain) return 'Unknown';
  let company = domain.split('.')[0];
  company = company.charAt(0).toUpperCase() + company.slice(1);
  return company;
};

// ═══════════════════════════════════════════════════════════════
// SYNC EMAILS - Simple, Fast, No Duplicates
// ═══════════════════════════════════════════════════════════════
router.post('/sync', authenticate, authorize('workflow_coordinator', 'it_admin', 'super_admin'), async (req, res) => {
  const workspaceId = req.user.workspace?._id?.toString();
  if (!workspaceId) return res.status(400).json({ message: 'Workspace required' });

  // Check sync lock
  const lock = syncLocks.get(workspaceId) || { busy: false, lastSync: null };
  if (lock.busy) return res.json({ message: 'Sync in progress', ticketsCreated: 0 });
  if (lock.lastSync && Date.now() - lock.lastSync < SYNC_COOLDOWN_MS) {
    return res.json({ message: 'Sync cooldown', ticketsCreated: 0 });
  }

  syncLocks.set(workspaceId, { busy: true, lastSync: lock.lastSync });

  try {
    // 1. Fetch starred emails from Gmail
    const emails = await fetchStarredEmails(
      process.env.EMAIL_USER,
      process.env.EMAIL_PASSWORD,
      req.user.workspace._id,
      req.user._id
    );

    if (!emails.length) {
      syncLocks.set(workspaceId, { busy: false, lastSync: new Date() });
      return res.json({ message: 'No starred emails', ticketsCreated: 0 });
    }

    // 2. Save emails to database
    await saveEmailsToDatabase(emails, req.user.workspace._id);

    // 3. Get client info for all sender emails
    const validEmails = emails.filter(e => e.messageId?.trim());
    const senderEmails = [...new Set(validEmails.map(e => e.from?.address?.toLowerCase()).filter(Boolean))];
    const clients = await findClientsByEmails(senderEmails);

    const clientMap = {};
    clients.forEach(c => {
      if (c.Email) clientMap[c.Email.toLowerCase()] = c;
    });

    // 4. Prepare tickets (MongoDB unique index prevents duplicates)
    // IMPORTANT: Email sender = Consultant, Company = Client
    const ticketsToCreate = await Promise.all(validEmails.map(async (e) => {
      const senderEmail = e.from?.address?.toLowerCase();
      const client = clientMap[senderEmail];

      let clientName, consultantName, clientType, jobCode;
      if (client) {
        // Found in database - use database values
        clientName = getClientName(client);  // Company name from DB
        consultantName = client['Consultant Name']?.trim() || '';
        clientType = null;  // Existing client
        jobCode = client['Job Code']?.trim() || 'JOB';  // Use client's Job Code
      } else {
        // Not in database - sender is consultant, derive company from domain
        consultantName = cleanName(e.from?.name) || '';  // Sender = Consultant
        clientName = getCompanyFromDomain(e.from?.address);  // Domain = Company
        clientType = 'New';  // Mark as new client
        jobCode = 'JOB';  // Default for unknown clients
      }

      // Generate sequential Job ID using client's Job Code (e.g., ABT-001, ABT-002)
      const jobId = await getNextJobId(jobCode);

      return {
        jobId,
        clientName,
        consultantName,
        clientEmail: e.from.address,
        subject: e.subject || '(No Subject)',
        status: 'not_assigned',
        createdBy: req.user.email,
        workspace: req.user.workspace._id,
        messageId: e.messageId,
        threadId: e.threadId,
        emailUid: e.uid,
        createdAt: e.date || new Date(),
        emailBodyHtml: e.body?.html || '',
        emailBodyText: e.body?.text || '',
        message: e.body?.text || e.body?.html || '',
        attachments: e.attachments || [],
        hasAttachments: (e.attachments || []).length > 0,
        meta: { clientType: clientType }  // "New" if not in database
      };
    }));

    // 5. Insert tickets - unique index prevents duplicates automatically
    let created = 0;
    try {
      const result = await Ticket.insertMany(ticketsToCreate, { ordered: false });
      created = result.length;
      console.log(`✅ Created ${created} new tickets`);
    } catch (err) {
      // BulkWriteError: some inserted, some were duplicates
      if (err.code === 11000 || err.insertedDocs) {
        created = err.insertedDocs?.length || 0;
        const duplicates = ticketsToCreate.length - created;
        console.log(`✅ Created ${created} tickets, ${duplicates} already existed`);
      } else {
        throw err;
      }
    }

    // 6. Link emails to tickets
    if (created > 0) {
      const createdTickets = await Ticket.find({
        workspace: req.user.workspace._id,
        messageId: { $in: validEmails.map(e => e.messageId) }
      }).select('jobId messageId').lean();

      const bulkOps = createdTickets.map(t => ({
        updateOne: {
          filter: { messageId: t.messageId, workspace: req.user.workspace._id },
          update: { $set: { jobId: t.jobId } }
        }
      }));

      if (bulkOps.length) await Email.bulkWrite(bulkOps, { ordered: false });
    }

    syncLocks.set(workspaceId, { busy: false, lastSync: new Date() });
    res.json({ message: 'Sync complete', emailsFetched: emails.length, ticketsCreated: created });

  } catch (err) {
    syncLocks.set(workspaceId, { busy: false, lastSync: null });
    console.error('Sync error:', err.message);
    res.status(500).json({ message: 'Sync failed', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET ALL EMAILS (paginated)
// ═══════════════════════════════════════════════════════════════
router.get('/', authenticate, authorize('workflow_coordinator', 'it_admin', 'super_admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 50;

    const [emails, total] = await Promise.all([
      getStoredEmails(req.user.workspace._id, limit, page * limit),
      getStoredEmailsCount(req.user.workspace._id)
    ]);

    res.json({ emails, pagination: { total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch emails', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET SINGLE EMAIL
// ═══════════════════════════════════════════════════════════════
router.get('/:id', authenticate, authorize('workflow_coordinator', 'it_admin', 'super_admin'), async (req, res) => {
  try {
    const email = await getEmailById(req.params.id);
    if (!email) return res.status(404).json({ message: 'Email not found' });

    res.json({ email });

    // Background: fetch body if missing
    if (email.uid && !email.body?.html) {
      setImmediate(async () => {
        try {
          const full = await fetchFullEmailByUid(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD, email.uid);
          await Email.findByIdAndUpdate(req.params.id, {
            body: full.body,
            attachments: full.attachments,
            hasAttachments: full.attachments?.length > 0
          });
        } catch (e) { /* silent */ }
      });
    }
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch email', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DOWNLOAD ATTACHMENT
// ═══════════════════════════════════════════════════════════════
router.get('/:emailId/attachments/:index', authenticate, authorize('workflow_coordinator', 'it_admin', 'super_admin'), async (req, res) => {
  try {
    let email = await getEmailById(req.params.emailId);
    if (!email) return res.status(404).json({ message: 'Email not found' });

    // Fetch if attachments missing
    if (email.hasAttachments && !email.attachments?.length) {
      const full = await fetchFullEmailByUid(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD, email.uid);
      await Email.findByIdAndUpdate(email._id, { body: full.body, attachments: full.attachments });
      email.attachments = full.attachments;
    }

    const att = email.attachments?.[parseInt(req.params.index)];
    if (!att) return res.status(404).json({ message: 'Attachment not found' });

    const buffer = Buffer.isBuffer(att.content) ? att.content : Buffer.from(att.content?.data || att.content, 'base64');
    res.setHeader('Content-Type', att.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(att.filename)}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: 'Download failed', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE EMAIL
// ═══════════════════════════════════════════════════════════════
router.delete('/:id', authenticate, authorize('workflow_coordinator', 'it_admin', 'super_admin'), async (req, res) => {
  try {
    await deleteEmail(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed', error: err.message });
  }
});

module.exports = router;
