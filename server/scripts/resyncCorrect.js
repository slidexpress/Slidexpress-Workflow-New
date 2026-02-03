/**
 * Re-sync emails with correct simpleParser and fix everything
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function resync() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected\n');

  const Email = require('../models/Email');
  const Ticket = require('../models/Ticket');
  const User = require('../models/User');
  const { fetchStarredEmails } = require('../services/emailService');
  const { findClientsByEmails, getClientName } = require('../models/Client');

  const coord = await User.findOne({ role: 'workflow_coordinator' }).lean();

  // Step 1: Fetch emails with correct parser
  console.log('Step 1: Fetching emails from Gmail...');
  const emails = await fetchStarredEmails(
    process.env.EMAIL_USER,
    process.env.EMAIL_PASSWORD,
    coord.workspace,
    coord._id
  );

  console.log('Fetched', emails.length, 'emails\n');

  // Step 2: Update Email collection
  console.log('Step 2: Updating Email collection...');
  for (const e of emails) {
    if (!e.messageId) continue;
    await Email.updateOne(
      { messageId: e.messageId },
      {
        $set: {
          'from.name': e.from.name,
          'from.address': e.from.address,
          subject: e.subject,
          isStarred: true
        }
      }
    );
  }
  console.log('Updated', emails.length, 'email records\n');

  // Create lookup map
  const emailByMessageId = {};
  emails.forEach(e => {
    if (e.messageId) emailByMessageId[e.messageId] = e;
  });

  // Step 3: Fix tickets
  console.log('Step 3: Fixing tickets...');
  const tickets = await Ticket.find({}).lean();

  // Get correct emails for tickets and update clientEmail
  const emailsToLookup = [];
  for (const t of tickets) {
    const emailDoc = t.messageId ? emailByMessageId[t.messageId] : null;
    if (emailDoc && emailDoc.from?.address) {
      if (emailDoc.from.address !== t.clientEmail) {
        await Ticket.updateOne(
          { _id: t._id },
          { $set: { clientEmail: emailDoc.from.address } }
        );
      }
      emailsToLookup.push(emailDoc.from.address.toLowerCase());
    } else {
      emailsToLookup.push(t.clientEmail?.toLowerCase());
    }
  }

  // Step 4: Client database lookup
  console.log('Step 4: Looking up clients...');
  const uniqueEmails = [...new Set(emailsToLookup.filter(Boolean))];
  const clients = await findClientsByEmails(uniqueEmails);
  const clientMap = {};
  clients.forEach(c => {
    if (c.Email) clientMap[c.Email.toLowerCase()] = c;
  });
  console.log('Found', clients.length, 'clients in database\n');

  // Helper functions
  const cleanName = (name) => {
    if (!name) return '';
    return name.replace(/['"]/g, '').trim();
  };

  const getCompanyFromDomain = (email) => {
    if (!email) return 'Unknown';
    const domain = email.split('@')[1];
    if (!domain) return 'Unknown';
    let company = domain.split('.')[0];
    return company.charAt(0).toUpperCase() + company.slice(1);
  };

  // Step 5: Update ticket names
  console.log('Step 5: Updating ticket names...\n');
  const refreshedTickets = await Ticket.find({}).lean();
  let updated = 0;

  for (const t of refreshedTickets) {
    const emailDoc = t.messageId ? emailByMessageId[t.messageId] : null;
    const email = t.clientEmail?.toLowerCase();
    const client = clientMap[email];

    let newClientName, newConsultantName, newClientType;

    if (client) {
      newClientName = getClientName(client);
      newConsultantName = client['Consultant Name']?.trim() || '';
      newClientType = null;
    } else {
      newConsultantName = cleanName(emailDoc?.from?.name || '');
      newClientName = getCompanyFromDomain(email);
      newClientType = 'New';
    }

    await Ticket.updateOne(
      { _id: t._id },
      {
        $set: {
          clientName: newClientName,
          consultantName: newConsultantName,
          'meta.clientType': newClientType
        }
      }
    );

    const status = client ? '✓' : 'NEW';
    console.log(t.jobId + ' [' + status + '] Client: ' + newClientName + ' | Consultant: ' + newConsultantName);
    updated++;
  }

  console.log('\n✅ Updated', updated, 'tickets');

  // Summary
  const finalTickets = await Ticket.find({}).lean();
  const newCount = finalTickets.filter(t => t.meta?.clientType === 'New').length;
  const existingCount = finalTickets.filter(t => !t.meta?.clientType).length;
  console.log('New clients:', newCount);
  console.log('Existing clients:', existingCount);

  await mongoose.disconnect();
}

resync().catch(console.error);
