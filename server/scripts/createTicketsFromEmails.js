/**
 * Create tickets from all starred emails that don't have tickets yet
 * Run: node server/scripts/createTicketsFromEmails.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function createTickets() {
  console.log('\n🎫 ====== CREATE TICKETS FROM EMAILS ======\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to database\n');

  const Email = require('../models/Email');
  const Ticket = require('../models/Ticket');
  const User = require('../models/User');
  const { findClientsByEmails, getClientName, getJobCodeForClient, generateJobCodeFromName } = require('../models/Client');
  const { getNextJobId } = require('../models/JobCounter');

  // Get coordinator for workspace
  const coordinator = await User.findOne({ role: 'workflow_coordinator' }).lean();
  if (!coordinator) {
    console.log('❌ No workflow_coordinator found');
    await mongoose.disconnect();
    return;
  }

  // Get all starred emails without tickets
  const emails = await Email.find({
    workspace: coordinator.workspace,
    isStarred: true,
    $or: [{ jobId: null }, { jobId: { $exists: false } }]
  }).lean();

  console.log(`📧 Found ${emails.length} starred emails without tickets\n`);

  if (emails.length === 0) {
    console.log('✅ All emails already have tickets');
    await mongoose.disconnect();
    return;
  }

  // Get client info
  const senderEmails = [...new Set(emails.map(e => e.from?.address?.toLowerCase()).filter(Boolean))];
  const clients = await findClientsByEmails(senderEmails);

  const clientMap = {};
  clients.forEach(c => {
    if (c.Email) clientMap[c.Email.toLowerCase()] = c;
  });

  console.log(`👥 Found ${clients.length} matching clients\n`);

  // Create tickets one by one to get proper sequential job IDs
  let created = 0;
  const createdTicketsList = [];

  for (const e of emails) {
    const senderEmail = e.from?.address?.toLowerCase();
    const client = clientMap[senderEmail];

    let clientName, consultantName, jobCode;
    if (client) {
      clientName = getClientName(client) || e.from?.name || e.from?.address || 'Unknown';
      consultantName = client['Consultant Name']?.trim() || '';
      // Get Job Code from DB or generate from client name
      jobCode = getJobCodeForClient(client, clientName);
    } else {
      clientName = e.from?.name || e.from?.address || 'Unknown';
      consultantName = '';
      // Generate Job Code from client name (first 3 letters)
      jobCode = generateJobCodeFromName(clientName);
    }

    // Generate sequential job ID (e.g., ABT001, ABT002)
    const jobId = await getNextJobId(jobCode);

    try {
      const ticket = await Ticket.create({
        jobId,
        clientName,
        consultantName,
        clientEmail: e.from?.address || 'unknown@email.com',
        subject: e.subject || '(No Subject)',
        status: 'not_assigned',
        createdBy: coordinator.email || 'System',
        workspace: coordinator.workspace,
        messageId: e.messageId,
        threadId: e.threadId,
        emailUid: e.uid,
        createdAt: e.date || new Date(),
        emailBodyHtml: e.body?.html || '',
        emailBodyText: e.body?.text || '',
        message: e.body?.text || e.body?.html || '',
        hasAttachments: (e.attachments || []).length > 0
      });
      created++;
      createdTicketsList.push(ticket);
      console.log(`   ✅ ${jobId} | ${clientName}`);
    } catch (err) {
      if (err.code === 11000) {
        console.log(`   ⚠️ Skipped duplicate: ${e.messageId}`);
      } else {
        console.error(`   ❌ Error: ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Created ${created} tickets\n`);

  // Link emails to tickets
  if (createdTicketsList.length > 0) {
    const bulkOps = createdTicketsList.map(t => ({
      updateOne: {
        filter: { messageId: t.messageId, workspace: coordinator.workspace },
        update: { $set: { jobId: t.jobId } }
      }
    }));

    if (bulkOps.length) await Email.bulkWrite(bulkOps, { ordered: false });
    console.log(`📧 Linked ${bulkOps.length} emails to tickets`);
  }

  // Final count
  const totalTickets = await Ticket.countDocuments({ workspace: coordinator.workspace });
  console.log(`\n📊 Total tickets in database: ${totalTickets}`);

  await mongoose.disconnect();
  console.log('\n🔌 Done');
}

createTickets().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
