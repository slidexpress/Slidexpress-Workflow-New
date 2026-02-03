/**
 * Fix tickets with correct email addresses from re-synced emails,
 * then lookup Client database for proper Client Name and Consultant Name
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected\n');

  const Ticket = require('../models/Ticket');
  const Email = require('../models/Email');
  const { findClientsByEmails, getClientName } = require('../models/Client');

  // Get all tickets
  const tickets = await Ticket.find({}).lean();
  console.log('Found', tickets.length, 'tickets\n');

  // Get all emails
  const emails = await Email.find({}).lean();
  const emailMap = {};
  emails.forEach(e => {
    if (e.messageId) emailMap[e.messageId] = e;
  });

  // Collect all email addresses for client lookup
  const allEmails = [];

  // First pass: update ticket email addresses from Email collection
  for (const t of tickets) {
    if (t.messageId && emailMap[t.messageId]) {
      const email = emailMap[t.messageId];
      const correctEmail = email.from?.address;
      if (correctEmail && correctEmail !== t.clientEmail) {
        await Ticket.updateOne({ _id: t._id }, { $set: { clientEmail: correctEmail } });
        console.log(t.jobId + ': Fixed email ' + t.clientEmail + ' → ' + correctEmail);
      }
      allEmails.push(correctEmail?.toLowerCase());
    } else {
      allEmails.push(t.clientEmail?.toLowerCase());
    }
  }

  // Get updated tickets
  const updatedTickets = await Ticket.find({}).lean();

  // Get all unique emails for client lookup
  const uniqueEmails = [...new Set(allEmails.filter(Boolean))];
  console.log('\nLooking up', uniqueEmails.length, 'emails in Client database...');

  const clients = await findClientsByEmails(uniqueEmails);
  const clientMap = {};
  clients.forEach(c => {
    if (c.Email) clientMap[c.Email.toLowerCase()] = c;
  });
  console.log('Found', clients.length, 'matching clients\n');

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

  // Second pass: update client names and consultant names
  let updated = 0;
  for (const t of updatedTickets) {
    const email = t.clientEmail?.toLowerCase();
    const client = clientMap[email];
    const emailDoc = t.messageId ? emailMap[t.messageId] : null;

    let newClientName, newConsultantName, newClientType;

    if (client) {
      // Found in database
      newClientName = getClientName(client);
      newConsultantName = client['Consultant Name']?.trim() || '';
      newClientType = null;  // Existing client
    } else {
      // Not in database - derive from email
      const senderName = emailDoc?.from?.name || cleanName(t.clientName);
      newConsultantName = senderName;  // Sender = Consultant
      newClientName = getCompanyFromDomain(email);  // Domain = Company
      newClientType = 'New';
    }

    // Check if update needed
    if (t.clientName !== newClientName || t.consultantName !== newConsultantName || t.meta?.clientType !== newClientType) {
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
      console.log(t.jobId + ':');
      console.log('  Client: ' + newClientName + (client ? ' (from DB)' : ' (from domain)'));
      console.log('  Consultant: ' + newConsultantName);
      console.log('  Type: ' + (newClientType || 'existing'));
      updated++;
    }
  }

  console.log('\n✅ Updated', updated, 'tickets');

  await mongoose.disconnect();
}

fix().catch(console.error);
