const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Email = require('../models/Email');
const TeamMember = require('../models/TeamMember');
const { sendAssignmentEmail } = require('../utils/email');

// Helper function to safely convert attachment content to base64
const contentToBase64 = (content) => {
  if (!content) return '';

  try {
    let buffer;
    if (Buffer.isBuffer(content)) {
      buffer = content;
    } else if (content.type === 'Buffer' && Array.isArray(content.data)) {
      // MongoDB format
      buffer = Buffer.from(content.data);
    } else if (content.buffer) {
      buffer = Buffer.from(content.buffer);
    } else if (typeof content === 'object' && content.data) {
      buffer = Buffer.from(content.data);
    } else if (typeof content === 'string') {
      // Already base64 or needs encoding
      return content;
    } else {
      buffer = Buffer.from(content);
    }
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error converting content to base64:', error);
    return '';
  }
};

// Function to convert plain text URLs to clickable links
const convertUrlsToLinks = (html) => {
  if (!html) return html;

  // URL regex pattern that matches http, https, and www URLs
  const urlPattern = /(\b(https?:\/\/|www\.)[^\s<>"]+)/gi;

  // Check if the text is already within an <a> tag
  const isInAnchorTag = (text, index) => {
    const before = text.substring(0, index);
    const openTagCount = (before.match(/<a\s/gi) || []).length;
    const closeTagCount = (before.match(/<\/a>/gi) || []).length;
    return openTagCount > closeTagCount;
  };

  // Replace URLs that are not already in anchor tags
  let result = html;
  let match;
  const matches = [];

  while ((match = urlPattern.exec(html)) !== null) {
    if (!isInAnchorTag(html, match.index)) {
      matches.push({
        url: match[0],
        index: match.index
      });
    }
  }

  // Process matches in reverse order to maintain correct indices
  matches.reverse().forEach(({ url, index }) => {
    const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
    const fullUrl = url.startsWith('www.') ? 'http://' + url : url;
    const linkHtml = `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; text-decoration: none;">${displayUrl}</a>`;
    result = result.substring(0, index) + linkHtml + result.substring(index + url.length);
  });

  return result;
};

// Get all tickets - ULTRA OPTIMIZED for INSTANT loading
router.get('/', async (req, res) => {
  try {
    const startTotal = Date.now();
    console.log('📊 === TICKET API PROFILING START ===');

    const limit = parseInt(req.query.limit) || 100; // REDUCED to 100 max
    const skip = parseInt(req.query.skip) || 0;

    // Build query filter
    const query = {};

    // Filter by workspace if user has one
    if (req.user && req.user.workspace) {
      query.workspace = req.user.workspace._id;
    }

    // Handle statuses filter (comma-separated string)
    if (req.query.statuses) {
      const statusArray = req.query.statuses.split(',').map(s => s.trim());
      query.status = { $in: statusArray };
    }

    console.time('1️⃣ Database query');
    const tickets = await Ticket.find(query)
      .select('-emails -message -attachments') // Exclude ALL heavy fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Lean for max speed
    console.timeEnd('1️⃣ Database query');

    console.log(`✅ Found ${tickets.length} tickets in ${Date.now() - startTotal}ms`);
    console.log(`📦 Payload size: ~${JSON.stringify(tickets).length / 1024} KB`);
    console.log('📊 === TICKET API PROFILING END ===\n');

    res.json({
      tickets,
      hasMore: tickets.length === limit,
      total: tickets.length
    });
  } catch (err) {
    console.error('❌ Ticket query error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Create new ticket
router.post('/', async (req, res) => {
  try {
    const ticket = new Ticket(req.body);

    // If this ticket was created from an email, populate the emails array
    if (req.body.sourceEmailId && req.body.jobId) {
      // Fetch the source email from database
      const sourceEmail = await Email.findById(req.body.sourceEmailId);

      if (sourceEmail) {
        // Process HTML for inline images
        let processedHtml = sourceEmail.body?.html || sourceEmail.body?.text || null;
        if (processedHtml && sourceEmail.attachments && sourceEmail.attachments.length > 0) {
          sourceEmail.attachments.forEach((att) => {
            if (att.contentId && att.contentType && att.contentType.startsWith('image/')) {
              const cid = att.contentId.replace(/^<|>$/g, '');
              const base64 = contentToBase64(att.content);
              const dataUri = `data:${att.contentType};base64,${base64}`;
              const cidPattern = new RegExp(`cid:${cid}`, 'gi');
              processedHtml = processedHtml.replace(cidPattern, dataUri);
            }
          });
        }

        // Convert plain text URLs to clickable links
        processedHtml = convertUrlsToLinks(processedHtml);

        // Add the source email to the ticket's emails array
        ticket.emails = [{
          _id: sourceEmail._id,
          from: sourceEmail.from?.address || sourceEmail.from?.name || 'Unknown',
          to: sourceEmail.to?.map(t => t.address || t.name).join(', ') || 'Unknown',
          subject: sourceEmail.subject || 'No Subject',
          body: sourceEmail.body?.text || 'No content',
          bodyHtml: processedHtml,
          date: sourceEmail.date,
          attachments: sourceEmail.attachments?.map((att) => ({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            content: att.content,
            contentId: att.contentId
          })) || []
        }];

        // Link the email to this jobId
        await Email.findByIdAndUpdate(
          req.body.sourceEmailId,
          { jobId: req.body.jobId },
          { new: true }
        );
      }
    }

    await ticket.save();

    res.json({ message: "Ticket created", ticket: ticket });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create multiple tickets from emails
router.post('/bulk-create', async (req, res) => {
  try {
    console.log('📝 Bulk create endpoint hit!');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      console.log('❌ No emails provided or invalid format');
      return res.status(400).json({ message: 'No emails provided' });
    }

    console.log(`📝 Creating ${emails.length} tickets from emails...`);

    const createdTickets = [];
    const errors = [];

    // Generate job IDs for each ticket
    const generateJobId = () => "JOB-" + Math.floor(100000 + Math.random() * 900000);

    for (const emailData of emails) {
      let ticketData = null; // Declare outside try block for error logging
      try {
        const jobId = generateJobId();

        // Fetch the source email from database
        const sourceEmail = await Email.findById(emailData._id);

        if (!sourceEmail) {
          console.error(`❌ Email not found in database: ${emailData._id}`);
          errors.push({ emailId: emailData._id, error: 'Email not found in database' });
          continue;
        }

        console.log(`📧 Processing email: ${sourceEmail.subject} from ${sourceEmail.from?.address || sourceEmail.from?.name || 'Unknown'}`);

        // Process HTML for inline images
        let processedHtml = sourceEmail.body?.html || null;
        if (processedHtml && sourceEmail.attachments && sourceEmail.attachments.length > 0) {
          sourceEmail.attachments.forEach((att) => {
            if (att.contentId && att.contentType && att.contentType.startsWith('image/')) {
              const cid = att.contentId.replace(/^<|>$/g, '');
              const base64 = contentToBase64(att.content);
              const dataUri = `data:${att.contentType};base64,${base64}`;
              const cidPattern = new RegExp(`cid:${cid}`, 'gi');
              processedHtml = processedHtml.replace(cidPattern, dataUri);
            }
          });
        }

        // Create ticket data
        ticketData = {
          jobId,
          consultantName: "Default Consultant",
          clientName: sourceEmail.from?.name || sourceEmail.from?.address || 'Unknown',
          clientEmail: sourceEmail.from?.address || 'unknown@email.com',
          subject: sourceEmail.subject || 'No Subject',
          message: sourceEmail.body?.text || '',
          status: 'not_assigned',
          createdBy: 'System User',
          emails: [{
            _id: sourceEmail._id,
            from: sourceEmail.from?.address || sourceEmail.from?.name || 'Unknown',
            to: sourceEmail.to?.map(t => t.address || t.name).join(', ') || 'Unknown',
            subject: sourceEmail.subject || 'No Subject',
            body: sourceEmail.body?.text || 'No content',
            bodyHtml: processedHtml,
            date: sourceEmail.date,
            attachments: sourceEmail.attachments?.map((att) => ({
              filename: att.filename,
              contentType: att.contentType,
              size: att.size,
              content: att.content,
              contentId: att.contentId
            })) || []
          }]
        };

        console.log(`🎫 Creating ticket with jobId: ${jobId}`);

        // Create and save ticket
        const ticket = new Ticket(ticketData);
        await ticket.save();

        console.log(`💾 Ticket saved successfully: ${ticket._id}`);

        // Link the email to this jobId
        await Email.findByIdAndUpdate(
          sourceEmail._id,
          { jobId },
          { new: true }
        );

        createdTickets.push(ticket);
        console.log(`✅ Created ticket ${jobId} from email ${sourceEmail.subject}`);

      } catch (error) {
        console.error(`❌ Error creating ticket from email ${emailData._id}:`, error.message);
        console.error('Error stack:', error.stack);
        if (ticketData) {
          console.error('Ticket data that failed:', JSON.stringify(ticketData, null, 2));
        }
        errors.push({ emailId: emailData._id, error: error.message, details: error.toString() });
      }
    }

    console.log(`✅ Bulk creation complete: ${createdTickets.length} tickets created, ${errors.length} errors`);

    res.json({
      message: `Created ${createdTickets.length} tickets successfully`,
      tickets: createdTickets,
      successCount: createdTickets.length,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('❌ Bulk ticket creation error:', err);
    console.error('Error stack:', err.stack);
    console.error('Error details:', {
      message: err.message,
      name: err.name,
      code: err.code
    });
    res.status(500).json({
      message: `Bulk creation failed: ${err.message}` || 'Something went wrong!',
      error: err.toString(),
      errorName: err.name,
      errorCode: err.code
    });
  }
});

// Update ticket (status / assignment)
router.put('/:id', async (req, res) => {
  try {
    const updateData = { ...req.body };

    // If status is changing to 'in_process', set startedAt timestamp
    if (req.body.status === 'in_process') {
      const existingTicket = await Ticket.findById(req.params.id);
      if (existingTicket && existingTicket.status !== 'in_process' && !existingTicket.startedAt) {
        updateData.startedAt = new Date();
      }
    }

    const ticket = await Ticket.findByIdAndUpdate(req.params.id, updateData, { new: true })
      .populate('assignedTo', 'name email');
    res.json({ message: "Ticket updated", ticket });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Assign ticket to team member with team lead
router.post('/:id/assign', async (req, res) => {
  try {
    // Get existing ticket to preserve meta field
    const existingTicket = await Ticket.findById(req.params.id);

    if (!existingTicket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const updateData = {
      assignedInfo: req.body.assignedInfo,
      status: req.body.status,
      meta: existingTicket.meta || {} // Preserve existing meta field
    };

    // Set assignedAt timestamp when assigning to a team member
    if (req.body.assignedInfo?.empName && !existingTicket.assignedAt) {
      updateData.assignedAt = new Date();
    }

    const ticket = await Ticket.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('assignedTo', 'name email');
    res.json({ message: "Ticket assigned", ticket });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Send assignment email with attachments
// SIMPLIFIED: No IMAP fetch - uses only cached data to avoid timeouts
router.post('/:id/send-assignment-email', async (req, res) => {
  try {
    const { empName } = req.body;
    console.log(`\n📧 ====== ASSIGNMENT EMAIL REQUEST ======`);
    console.log(`📧 Ticket ID: ${req.params.id}`);
    console.log(`👤 Employee: ${empName}`);

    if (!empName) {
      return res.status(400).json({ message: 'Employee name is required' });
    }

    // Get ticket details
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Get team member email
    const trimmedName = empName.trim();
    let teamMember = await TeamMember.findOne({ name: trimmedName });

    // Try case-insensitive search
    if (!teamMember) {
      teamMember = await TeamMember.findOne({
        name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }

    // Check if it's a team lead
    if (!teamMember) {
      const memberUnderThisTL = await TeamMember.findOne({
        tlName: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (memberUnderThisTL) {
        teamMember = await TeamMember.findOne({
          name: { $regex: new RegExp(`^${memberUnderThisTL.tlName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });
      }
    }

    if (!teamMember) {
      return res.status(404).json({
        message: `Team member not found: ${empName}`
      });
    }

    if (!teamMember.emailId) {
      return res.status(400).json({
        message: `Email not configured for: ${empName}. Add email in Team Settings.`
      });
    }

    console.log(`✓ Sending to: ${teamMember.emailId}`);

    // Prepare ticket data
    const ticketData = {
      jobId: ticket.jobId,
      clientName: ticket.clientName,
      consultantName: ticket.consultantName,
      teamLead: ticket.assignedInfo?.teamLead,
      deadline: ticket.meta?.deadline,
      timezone: ticket.meta?.timezone
    };

    // Get original email from database (NO IMAP fetch - use cached only)
    let originalEmail = null;
    if (ticket.jobId) {
      originalEmail = await Email.findOne({ jobId: ticket.jobId }).lean();
    }
    if (!originalEmail && ticket.messageId) {
      originalEmail = await Email.findOne({ messageId: ticket.messageId }).lean();
    }

    // Send email (no attachments to avoid size issues)
    const result = await sendAssignmentEmail(teamMember.emailId, ticketData, [], originalEmail);

    if (result.success) {
      console.log(`✅ Email sent to ${teamMember.emailId} via ${result.provider}`);
      res.json({
        message: `Email sent successfully to ${teamMember.emailId}`,
        provider: result.provider
      });
    } else {
      console.log(`❌ Failed: ${result.error}`);
      res.status(500).json({
        message: `Failed to send email: ${result.error}`,
        error: result.error
      });
    }
  } catch (err) {
    console.error('Send assignment email error:', err);
    res.status(500).json({
      message: `Error: ${err.message}`,
      error: err.message
    });
  }
});

// Undo ticket creation - removes jobId from emails and deletes ticket
router.post('/:id/undo', async (req, res) => {
  try {
    const ticketId = req.params.id;
    console.log(`↩️ Attempting to undo ticket: ${ticketId}`);

    // Get the ticket
    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      console.log(`❌ Ticket not found: ${ticketId}`);
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Only allow undo for not_assigned tickets
    if (ticket.status !== 'not_assigned') {
      console.log(`❌ Cannot undo assigned ticket: ${ticket.status}`);
      return res.status(400).json({
        message: "Cannot undo ticket that has been assigned. Only 'not_assigned' tickets can be undone."
      });
    }

    // Remove jobId from all associated emails to make them appear in Mail page again
    if (ticket.jobId) {
      const result = await Email.updateMany(
        { jobId: ticket.jobId },
        { $unset: { jobId: "" } }
      );
      console.log(`✓ Removed jobId from ${result.modifiedCount} email(s)`);
    }

    // Delete the ticket
    await Ticket.findByIdAndDelete(ticketId);

    console.log(`✅ Ticket undone and deleted successfully: ${ticketId}`);
    res.json({
      message: "Ticket undone successfully. Email(s) restored to Mail page.",
      ticket: ticket
    });
  } catch (err) {
    console.error(`❌ Error undoing ticket:`, err);
    res.status(500).json({ message: err.message });
  }
});

// Delete ticket
router.delete('/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;
    console.log(`🗑️ Attempting to delete ticket: ${ticketId}`);

    const deletedTicket = await Ticket.findByIdAndDelete(ticketId);

    if (!deletedTicket) {
      console.log(`❌ Ticket not found: ${ticketId}`);
      return res.status(404).json({ message: "Ticket not found" });
    }

    console.log(`✅ Ticket deleted successfully: ${ticketId}`);
    res.json({ message: "Ticket deleted", ticket: deletedTicket });
  } catch (err) {
    console.error(`❌ Error deleting ticket:`, err);
    res.status(500).json({ message: err.message });
  }
});

// Get emails by Job ID
router.get('/emails/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    // Find all emails associated with this jobId
    const emails = await Email.find({ jobId }).sort({ date: -1 });

    // Format emails for the frontend
    const formattedEmails = emails.map(email => {
      let processedHtml = email.body?.html || '';

      // Convert Content-ID (cid:) image references to base64 data URIs
      if (processedHtml && email.attachments && email.attachments.length > 0) {
        email.attachments.forEach((att) => {
          if (att.contentId && att.contentType && att.contentType.startsWith('image/')) {
            // Remove < and > from contentId if present
            const cid = att.contentId.replace(/^<|>$/g, '');

            // Convert buffer to base64
            const base64 = att.content ? Buffer.from(att.content).toString('base64') : '';
            const dataUri = `data:${att.contentType};base64,${base64}`;

            // Replace all occurrences of cid: references with data URI
            const cidPattern = new RegExp(`cid:${cid}`, 'gi');
            processedHtml = processedHtml.replace(cidPattern, dataUri);
          }
        });
      }

      // Debug logging
      console.log(`Email ${email._id} body data:`, {
        hasHtml: !!(email.body?.html && email.body.html.trim()),
        htmlLength: email.body?.html?.length || 0,
        hasText: !!(email.body?.text && email.body.text.trim()),
        textLength: email.body?.text?.length || 0
      });

      return {
        _id: email._id,
        from: email.from?.address || email.from?.name || 'Unknown',
        to: email.to?.map(t => t.address || t.name).join(', ') || 'Unknown',
        subject: email.subject || 'No Subject',
        body: email.body?.text || '',
        bodyHtml: processedHtml || null,
        date: email.date,
        attachments: email.attachments?.filter(att =>
          // Filter out inline images (those with contentId)
          !att.contentId
        ).map((att, idx) => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          index: idx
        })) || []
      };
    });

    res.json({ emails: formattedEmails });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Download attachment from ticket email
router.get('/:ticketId/emails/:emailId/attachments/:attachmentIndex', async (req, res) => {
  try {
    const { ticketId, emailId, attachmentIndex } = req.params;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const email = ticket.emails?.find(e => e._id.toString() === emailId);
    if (!email) {
      return res.status(404).json({ message: 'Email not found in ticket' });
    }

    const attachment = email.attachments?.[parseInt(attachmentIndex)];
    if (!attachment) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    if (!attachment.content) {
      return res.status(500).json({ message: 'Attachment content is missing' });
    }

    // Convert the content to a proper Buffer
    let buffer;
    try {
      console.log(`📦 Converting ticket attachment to buffer...`);
      console.log(`   - File: ${attachment.filename}`);
      console.log(`   - Content type: ${typeof attachment.content}`);

      if (Buffer.isBuffer(attachment.content)) {
        console.log(`✓ Content is already a Buffer`);
        buffer = attachment.content;
      } else if (attachment.content.type === 'Buffer' && Array.isArray(attachment.content.data)) {
        console.log(`✓ Converting from MongoDB Buffer format`);
        buffer = Buffer.from(attachment.content.data);
      } else if (attachment.content.buffer) {
        console.log(`✓ Converting from ArrayBuffer format`);
        buffer = Buffer.from(attachment.content.buffer);
      } else if (typeof attachment.content === 'object' && attachment.content.data) {
        console.log(`✓ Converting from object with data property`);
        buffer = Buffer.from(attachment.content.data);
      } else if (typeof attachment.content === 'string') {
        console.log(`✓ Converting from base64 string`);
        buffer = Buffer.from(attachment.content, 'base64');
      } else {
        console.log(`⚠️ Attempting direct conversion`);
        buffer = Buffer.from(attachment.content);
      }

      console.log(`✓ Buffer created: ${buffer.length} bytes`);
    } catch (bufferError) {
      console.error(`❌ Buffer conversion error:`, bufferError);
      return res.status(500).json({
        message: 'Failed to convert attachment content to buffer',
        error: bufferError.message
      });
    }

    res.setHeader('Content-Type', attachment.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error downloading attachment:', err);
    res.status(500).json({ message: err.message });
  }
});

// Remove a specific email from a ticket
router.post('/:id/remove-email', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { emailId } = req.body;

    console.log(`🗑️ Removing email ${emailId} from ticket ${ticketId}`);

    if (!emailId) {
      return res.status(400).json({ message: 'Email ID is required' });
    }

    // Get the ticket
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Remove the email from ticket's emails array
    const originalLength = ticket.emails?.length || 0;
    ticket.emails = ticket.emails?.filter(email => email._id.toString() !== emailId) || [];
    const newLength = ticket.emails.length;

    if (originalLength === newLength) {
      return res.status(404).json({ message: 'Email not found in this ticket' });
    }

    await ticket.save();

    // Remove the jobId from the email document so it appears back in Mail page
    await Email.findByIdAndUpdate(emailId, { $unset: { jobId: "" } });

    console.log(`✅ Successfully removed email ${emailId} from ticket ${ticket.jobId}`);

    res.json({
      message: 'Email removed successfully',
      ticket,
      removedEmailId: emailId
    });
  } catch (err) {
    console.error('❌ Error removing email:', err);
    res.status(500).json({ message: err.message });
  }
});

// Attach multiple emails to an existing ticket
router.post('/:id/attach-emails', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const { emails } = req.body;

    console.log(`📎 Attaching ${emails?.length || 0} emails to ticket ${ticketId}`);

    if (!emails || emails.length === 0) {
      return res.status(400).json({ message: 'No emails provided' });
    }

    // Get the ticket
    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Update each email's jobId to link them to this ticket
    const emailIds = emails.map(e => e._id);
    await Email.updateMany(
      { _id: { $in: emailIds } },
      { $set: { jobId: ticket.jobId } }
    );

    // Fetch full email data from database for each selected email
    const fullEmailsData = await Email.find({ _id: { $in: emailIds } });

    // Store complete email data in ticket's emails array
    const existingEmails = ticket.emails || [];
    console.log(`📧 Existing emails in ticket: ${existingEmails.length}`);
    const newEmailRefs = fullEmailsData.map(email => {
      let processedHtml = email.body?.html || null;

      // Convert Content-ID (cid:) image references to base64 data URIs
      if (processedHtml && email.attachments && email.attachments.length > 0) {
        email.attachments.forEach((att) => {
          if (att.contentId && att.contentType && att.contentType.startsWith('image/')) {
            const cid = att.contentId.replace(/^<|>$/g, '');
            const base64 = att.content ? Buffer.from(att.content).toString('base64') : '';
            const dataUri = `data:${att.contentType};base64,${base64}`;
            const cidPattern = new RegExp(`cid:${cid}`, 'gi');
            processedHtml = processedHtml.replace(cidPattern, dataUri);
          }
        });
      }

      return {
        _id: email._id,
        from: email.from?.address || email.from?.name || 'Unknown',
        to: email.to?.map(t => t.address || t.name).join(', ') || 'Unknown',
        subject: email.subject || 'No Subject',
        body: email.body?.text || 'No content',
        bodyHtml: processedHtml,
        date: email.date,
        attachments: email.attachments?.map((att, idx) => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          content: att.content, // Store the actual content for downloads
          contentId: att.contentId
        })) || []
      };
    });

    // Merge and deduplicate
    console.log(`➕ Adding ${newEmailRefs.length} new emails`);
    const allEmails = [...existingEmails, ...newEmailRefs];
    console.log(`📊 Total emails after merge: ${allEmails.length}`);
    const uniqueEmails = Array.from(new Map(allEmails.map(e => [e._id.toString(), e])).values());
    console.log(`🔢 Unique emails after deduplication: ${uniqueEmails.length}`);

    ticket.emails = uniqueEmails;
    await ticket.save();

    console.log(`✅ Successfully attached ${emails.length} emails to ticket ${ticket.jobId}`);

    res.json({
      message: 'Emails attached successfully',
      ticket,
      attachedCount: emails.length
    });
  } catch (err) {
    console.error('❌ Error attaching emails:', err);
    res.status(500).json({ message: err.message });
  }
});

// Merge source ticket into target ticket
router.post('/:id/merge', async (req, res) => {
  try {
    const targetTicketId = req.params.id;
    const { sourceTicketId, sourceJobId } = req.body;

    console.log(`🔀 ====== MERGING TICKETS ======`);
    console.log(`🎯 Target Ticket ID: ${targetTicketId}`);
    console.log(`📤 Source Ticket ID: ${sourceTicketId}`);
    console.log(`🏷️  Source Job ID: ${sourceJobId}`);

    if (!sourceTicketId) {
      return res.status(400).json({ message: 'Source ticket ID is required' });
    }

    // Get both tickets
    const targetTicket = await Ticket.findById(targetTicketId);
    const sourceTicket = await Ticket.findById(sourceTicketId);

    if (!targetTicket) {
      return res.status(404).json({ message: 'Target ticket not found' });
    }

    if (!sourceTicket) {
      return res.status(404).json({ message: 'Source ticket not found' });
    }

    console.log(`✅ Found target ticket: ${targetTicket.jobId}`);
    console.log(`✅ Found source ticket: ${sourceTicket.jobId}`);

    // Validate that both tickets are from the same client
    const sourceClientEmail = sourceTicket.clientEmail?.toLowerCase();
    const targetClientEmail = targetTicket.clientEmail?.toLowerCase();
    const sourceClientName = sourceTicket.clientName?.toLowerCase();
    const targetClientName = targetTicket.clientName?.toLowerCase();

    const isSameClient =
      (sourceClientEmail && targetClientEmail && sourceClientEmail === targetClientEmail) ||
      (sourceClientName && targetClientName && sourceClientName === targetClientName);

    if (!isSameClient) {
      console.log(`❌ Cannot merge: Different clients`);
      console.log(`   Source: ${sourceTicket.clientName} (${sourceTicket.clientEmail})`);
      console.log(`   Target: ${targetTicket.clientName} (${targetTicket.clientEmail})`);
      return res.status(400).json({
        message: 'Cannot merge tickets from different clients',
        sourceClient: sourceTicket.clientName,
        targetClient: targetTicket.clientName
      });
    }

    console.log(`✅ Client validation passed: ${targetTicket.clientName}`);

    // Merge emails from source to target
    const sourceEmails = sourceTicket.emails || [];
    const targetEmails = targetTicket.emails || [];

    console.log(`📧 Source ticket has ${sourceEmails.length} emails`);
    console.log(`📧 Target ticket has ${targetEmails.length} emails`);

    // Combine emails and deduplicate by email._id
    const allEmails = [...targetEmails, ...sourceEmails];
    const uniqueEmails = Array.from(new Map(allEmails.map(e => [e._id.toString(), e])).values());

    console.log(`📊 Total unique emails after merge: ${uniqueEmails.length}`);

    // Update the target ticket with merged emails
    targetTicket.emails = uniqueEmails;

    // Add a note about the merge to the target ticket
    const mergeNote = `Merged from ${sourceTicket.jobId} on ${new Date().toISOString()}`;
    if (!targetTicket.mergeHistory) {
      targetTicket.mergeHistory = [];
    }
    targetTicket.mergeHistory.push({
      sourceJobId: sourceTicket.jobId,
      sourceTicketId: sourceTicket._id,
      mergedAt: new Date(),
      emailCount: sourceEmails.length
    });

    // Update merge count (total number of tickets that have been merged into this one)
    targetTicket.mergeCount = (targetTicket.mergeCount || 0) + 1;
    console.log(`📊 Merge count for ${targetTicket.jobId}: ${targetTicket.mergeCount}`);

    await targetTicket.save();

    // Update all emails that were linked to source ticket to point to target ticket
    // Also set isStarred to false to prevent emails from appearing in Mail page again
    if (sourceTicket.jobId) {
      await Email.updateMany(
        { jobId: sourceTicket.jobId },
        { $set: { jobId: targetTicket.jobId, isStarred: false } }
      );
      console.log(`✅ Updated all emails with jobId ${sourceTicket.jobId} to ${targetTicket.jobId} and marked as not starred`);
    }

    // Delete the source ticket after merging
    await Ticket.findByIdAndDelete(sourceTicketId);
    console.log(`🗑️  Deleted source ticket ${sourceTicket.jobId}`);

    console.log(`✅ ====== MERGE COMPLETED ======`);

    res.json({
      message: 'Tickets merged successfully',
      targetTicket,
      mergedEmailCount: sourceEmails.length,
      totalEmailCount: uniqueEmails.length
    });
  } catch (err) {
    console.error('❌ Error merging tickets:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get full email content for a ticket (OPTIMIZED: Database-first, IMAP fallback)
router.get('/:id/email-content', async (req, res) => {
  try {
    console.log(`📧 Email content request for ticket ID: ${req.params.id}`);

    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      console.log(`❌ Ticket not found: ${req.params.id}`);
      return res.status(404).json({ message: 'Ticket not found' });
    }

    console.log(`✓ Found ticket ${ticket.jobId}, messageId: ${ticket.messageId || 'NONE'}`);

    if (!ticket.messageId) {
      console.log(`❌ Ticket ${ticket.jobId} has no messageId`);
      return res.status(404).json({ message: 'No email associated with this ticket' });
    }

    // ============================================================================
    // OPTIMIZATION 1: Check if ticket has cached content (INSTANT - fastest)
    // ============================================================================
    // Check new fields first (emailBodyHtml, emailBodyText) for INSTANT access
    if ((ticket.emailBodyHtml && ticket.emailBodyHtml.trim() !== '') ||
        (ticket.emailBodyText && ticket.emailBodyText.trim() !== '')) {
      console.log(`⚡ INSTANT: Using embedded email content in ticket ${ticket.jobId} (${ticket.emailBodyHtml?.length || 0} chars HTML)`);
      return res.json({
        emailContent: {
          html: ticket.emailBodyHtml || '',
          text: ticket.emailBodyText || ticket.message || '',
          from: ticket.clientEmail || ticket.emailFrom,
          subject: ticket.subject,
          date: ticket.createdAt || ticket.emailDate,
          attachments: ticket.attachments || []
        }
      });
    }

    // Fallback to old message field
    if (ticket.message && ticket.message.trim() !== '') {
      console.log(`⚡ INSTANT: Using cached content in ticket ${ticket.jobId}`);
      return res.json({
        emailContent: {
          html: ticket.message,
          text: ticket.message,
          from: ticket.clientEmail || ticket.emailFrom,
          subject: ticket.subject,
          date: ticket.createdAt || ticket.emailDate,
          attachments: ticket.attachments || []
        }
      });
    }

    // ============================================================================
    // OPTIMIZATION 2: Fetch from Email collection (very fast, already cached)
    // ============================================================================
    console.log(`🔍 Searching Email collection for messageId: ${ticket.messageId}`);
    const Email = require('../models/Email');
    const emailDoc = await Email.findOne({ messageId: ticket.messageId }).lean();

    if (emailDoc && emailDoc.body && (emailDoc.body.html || emailDoc.body.text)) {
      console.log(`⚡ FAST: Found email in database collection (${emailDoc.body.html?.length || 0} chars HTML, ${emailDoc.body.text?.length || 0} chars text)`);

      // Cache content in ticket for even faster future access (using new fields)
      setImmediate(async () => {
        try {
          await Ticket.findByIdAndUpdate(req.params.id, {
            $set: {
              emailBodyHtml: emailDoc.body.html || '',
              emailBodyText: emailDoc.body.text || '',
              message: emailDoc.body.text || emailDoc.body.html || '',
              attachments: emailDoc.attachments || [],
              hasAttachments: (emailDoc.attachments || []).length > 0
            }
          });
          console.log(`✓ Background: Cached email content in ticket ${ticket.jobId}`);
        } catch (err) {
          console.error('⚠️ Background caching failed:', err.message);
        }
      });

      return res.json({
        emailContent: {
          html: emailDoc.body.html || '',
          text: emailDoc.body.text || '',
          from: emailDoc.from?.address || ticket.clientEmail,
          subject: emailDoc.subject || ticket.subject,
          date: emailDoc.date || ticket.createdAt,
          attachments: emailDoc.attachments || []
        }
      });
    }

    console.log(`⚠️ Email not found in database, falling back to IMAP fetch...`);

    // ============================================================================
    // FALLBACK: Fetch from Gmail via IMAP (slow, last resort)
    // ============================================================================
    const { fetchFullEmailByUid } = require('../services/emailService');

    const emailCredentials = {
      email: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD
    };

    if (!emailCredentials.email || !emailCredentials.password) {
      console.log(`❌ Email credentials not configured`);
      return res.status(500).json({ message: 'Email server credentials not configured' });
    }

    // Check if ticket has emailUid
    if (!ticket.emailUid) {
      console.log(`❌ Ticket ${ticket.jobId} has no emailUid - cannot fetch from IMAP`);
      return res.status(400).json({
        message: 'Email content not cached. Please wait for background sync or click Sync button.'
      });
    }

    console.log(`📧 SLOW: Fetching email by UID ${ticket.emailUid} from Gmail IMAP...`);

    let fullEmailData;
    try {
      fullEmailData = await fetchFullEmailByUid(
        emailCredentials.email,
        emailCredentials.password,
        ticket.emailUid
      );
    } catch (error) {
      console.error(`❌ IMAP fetch failed for UID ${ticket.emailUid}:`, error.message);
      return res.status(500).json({
        message: 'Failed to fetch email from Gmail. The email may have been deleted or moved.',
        error: error.message
      });
    }

    if (!fullEmailData || (!fullEmailData.body?.html && !fullEmailData.body?.text)) {
      console.log(`❌ Email content not found in Gmail for UID: ${ticket.emailUid}`);
      return res.status(404).json({
        message: 'Email content not found. The email may have been deleted from Gmail.'
      });
    }

    console.log(`✅ IMAP fetch successful:`);
    console.log(`   - HTML length: ${fullEmailData.body?.html?.length || 0}`);
    console.log(`   - Text length: ${fullEmailData.body?.text?.length || 0}`);
    console.log(`   - Attachments: ${fullEmailData.attachments?.length || 0}`);

    // Cache content in both ticket AND email collection for future INSTANT access
    const cachePromises = [
      Ticket.findByIdAndUpdate(req.params.id, {
        $set: {
          emailBodyHtml: fullEmailData.body?.html || '',
          emailBodyText: fullEmailData.body?.text || '',
          message: fullEmailData.body?.text || fullEmailData.body?.html || '',
          attachments: fullEmailData.attachments || [],
          hasAttachments: (fullEmailData.attachments || []).length > 0
        }
      }),
      Email.findOneAndUpdate(
        { messageId: ticket.messageId },
        {
          $set: {
            body: fullEmailData.body,
            attachments: fullEmailData.attachments,
            hasAttachments: fullEmailData.attachments?.length > 0
          }
        }
      )
    ];

    await Promise.all(cachePromises);
    console.log(`✓ Cached IMAP content in both ticket and email collection`);

    res.json({
      emailContent: {
        html: fullEmailData.body?.html || '',
        text: fullEmailData.body?.text || '',
        from: ticket.clientEmail || ticket.emailFrom,
        subject: ticket.subject,
        date: ticket.createdAt || ticket.emailDate,
        attachments: fullEmailData.attachments || []
      }
    });
  } catch (error) {
    console.error('❌ Error fetching email content:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      message: 'Failed to fetch email content',
      error: error.message
    });
  }
});

module.exports = router;
