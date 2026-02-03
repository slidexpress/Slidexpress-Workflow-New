/**
 * Full ticket fix:
 * 1. Get correct email address from Email collection
 * 2. Update ticket's clientEmail
 * 3. Lookup in Client database
 * 4. Set proper clientName, consultantName, clientType
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected\n');

  const Ticket = require('../models/Ticket');
  const Email = require('../models/Email');
  const { findClientsByEmails, getClientName } = require('../models/Client');

  // Helper functions
  const cleanName = (name) => {
    if (!name) return '';
    let cleaned = name.replace(/['"]/g, '').trim();
    cleaned = cleaned.replace(/<[^>]*>?.*$/, '').trim();
    cleaned = cleaned.replace(/\s*\(via\s+Google.*\)$/i, '').trim();
    return cleaned;
  };

  const getCompanyFromDomain = (email) => {
    if (!email) return 'Unknown';
    const domain = email.split('@')[1];
    if (!domain) return 'Unknown';
    let company = domain.split('.')[0];
    return company.charAt(0).toUpperCase() + company.slice(1);
  };

  // Get all tickets and emails
  const tickets = await Ticket.find({}).lean();
  const emails = await Email.find({}).lean();

  console.log('Tickets:', tickets.length);
  console.log('Emails:', emails.length);

  // Create email lookup by messageId
  const emailByMessageId = {};
  emails.forEach(e => {
    if (e.messageId) emailByMessageId[e.messageId] = e;
  });

  // First: update ticket email addresses from Email collection
  console.log('\n--- Step 1: Fix email addresses ---');
  const emailsToLookup = [];

  for (const t of tickets) {
    const emailDoc = t.messageId ? emailByMessageId[t.messageId] : null;

    if (emailDoc && emailDoc.from?.address) {
      const correctEmail = emailDoc.from.address;
      if (correctEmail !== t.clientEmail) {
        await Ticket.updateOne(
          { _id: t._id },
          { $set: { clientEmail: correctEmail } }
        );
        console.log(t.jobId + ': Email fixed → ' + correctEmail);
      }
      emailsToLookup.push(correctEmail.toLowerCase());
    } else {
      emailsToLookup.push(t.clientEmail?.toLowerCase());
    }
  }

  // Get unique emails for client lookup
  const uniqueEmails = [...new Set(emailsToLookup.filter(Boolean))];
  console.log('\n--- Step 2: Lookup', uniqueEmails.length, 'emails in Client DB ---');

  const clients = await findClientsByEmails(uniqueEmails);
  const clientMap = {};
  clients.forEach(c => {
    if (c.Email) clientMap[c.Email.toLowerCase()] = c;
  });

  console.log('Found', clients.length, 'clients in database');

  // Refresh tickets after email update
  const updatedTickets = await Ticket.find({}).lean();

  // Second: update client names and types
  console.log('\n--- Step 3: Update client names ---');
  let updated = 0;

  for (const t of updatedTickets) {
    const emailDoc = t.messageId ? emailByMessageId[t.messageId] : null;
    const email = t.clientEmail?.toLowerCase();
    const client = clientMap[email];

    let newClientName, newConsultantName, newClientType;

    if (client) {
      // Found in database
      newClientName = getClientName(client);
      newConsultantName = client['Consultant Name']?.trim() || '';
      newClientType = null;  // Existing client
    } else {
      // Not in database
      const senderName = emailDoc?.from?.name || '';
      newConsultantName = cleanName(senderName);
      newClientName = getCompanyFromDomain(email);
      newClientType = 'New';
    }

    // Check if update needed
    const needsUpdate =
      t.clientName !== newClientName ||
      t.consultantName !== newConsultantName ||
      (t.meta?.clientType || null) !== newClientType;

    if (needsUpdate) {
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

      const typeStr = newClientType ? ' [NEW]' : ' [existing]';
      console.log(t.jobId + ': ' + newClientName + ' | ' + newConsultantName + typeStr);
      updated++;
    }
  }

  console.log('\n✅ Updated', updated, 'tickets');

  // Summary
  const finalTickets = await Ticket.find({}).select('jobId clientName consultantName meta.clientType').lean();
  const newCount = finalTickets.filter(t => t.meta?.clientType === 'New').length;
  const existingCount = finalTickets.filter(t => !t.meta?.clientType).length;

  console.log('\n--- Summary ---');
  console.log('New clients:', newCount);
  console.log('Existing clients:', existingCount);

  await mongoose.disconnect();
}

fix().catch(console.error);
