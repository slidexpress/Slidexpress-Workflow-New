/**
 * Restore consultant names from original email sender data
 *
 * This script fixes tickets where consultant name was incorrectly set to the domain
 * by looking up the original email sender name.
 *
 * Run: node server/scripts/restoreConsultantNames.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// Clean up name from email format
const cleanName = (name) => {
  if (!name) return '';
  let cleaned = name.replace(/['"]/g, '').trim();
  // Remove email part like "<email@domain.com>"
  cleaned = cleaned.replace(/<[^>]*>?.*$/, '').trim();
  // Remove "(via Google...)" suffix
  cleaned = cleaned.replace(/\s*\(via\s+Google.*\)$/i, '').trim();
  return cleaned;
};

async function restoreNames() {
  console.log('\n🔧 ====== RESTORE CONSULTANT NAMES ======\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to database\n');

  const Ticket = require('../models/Ticket');
  const Email = require('../models/Email');
  const { findClientsByEmails, getClientName } = require('../models/Client');

  // Get all tickets
  const tickets = await Ticket.find({}).lean();
  console.log(`📋 Found ${tickets.length} tickets to check\n`);

  // Get client info for all emails
  const emails = [...new Set(tickets.map(t => t.clientEmail?.toLowerCase()).filter(Boolean))];
  const clients = await findClientsByEmails(emails);

  const clientMap = {};
  clients.forEach(c => {
    if (c.Email) clientMap[c.Email.toLowerCase()] = c;
  });

  console.log(`👥 Found ${clients.length} matching clients in database\n`);

  let updated = 0;

  for (const ticket of tickets) {
    const senderEmail = ticket.clientEmail?.toLowerCase();
    const client = clientMap[senderEmail];

    let newClientName, newConsultantName;

    if (client) {
      // Found in database - use database values
      newClientName = getClientName(client);
      newConsultantName = client['Consultant Name']?.trim() || '';
    } else {
      // Not in database - need to get sender name from email

      // Try to find the original email by messageId or jobId
      let email = null;
      if (ticket.messageId) {
        email = await Email.findOne({ messageId: ticket.messageId }).lean();
      }
      if (!email && ticket.jobId) {
        email = await Email.findOne({ jobId: ticket.jobId }).lean();
      }

      if (email && email.from?.name) {
        // Get sender name from original email
        newConsultantName = cleanName(email.from.name);
        console.log(`   📧 Found email sender: "${email.from.name}" → "${newConsultantName}"`);
      } else {
        // No email found or no sender name - keep existing if it's not a domain
        const currentConsultant = ticket.consultantName || '';
        const currentClient = ticket.clientName || '';

        // If current consultant looks like a domain (same as client), don't use it
        if (currentConsultant.toLowerCase() === currentClient.toLowerCase()) {
          newConsultantName = '';  // Will try to get from emails array
        } else {
          newConsultantName = cleanName(currentConsultant);
        }
      }

      // Also check ticket's embedded emails array for sender name
      if (!newConsultantName && ticket.emails && ticket.emails.length > 0) {
        const firstEmail = ticket.emails[0];
        if (firstEmail.from) {
          // Parse "email@domain.com" or "Name <email@domain.com>" format
          const fromStr = firstEmail.from;
          if (fromStr.includes('<')) {
            newConsultantName = cleanName(fromStr.split('<')[0]);
          }
        }
      }

      // Get company from domain
      const domain = senderEmail?.split('@')[1];
      const company = domain ? domain.split('.')[0] : 'Unknown';
      newClientName = company.charAt(0).toUpperCase() + company.slice(1);
    }

    // Check if update needed
    const needsClientUpdate = ticket.clientName !== newClientName;
    const needsConsultantUpdate = ticket.consultantName !== newConsultantName && newConsultantName;

    if (needsClientUpdate || needsConsultantUpdate) {
      const updateData = {};
      if (needsClientUpdate) updateData.clientName = newClientName;
      if (needsConsultantUpdate) updateData.consultantName = newConsultantName;

      await Ticket.updateOne(
        { _id: ticket._id },
        { $set: updateData }
      );

      console.log(`✅ ${ticket.jobId}:`);
      if (needsClientUpdate) {
        console.log(`   Client: "${ticket.clientName}" → "${newClientName}"`);
      }
      if (needsConsultantUpdate) {
        console.log(`   Consultant: "${ticket.consultantName}" → "${newConsultantName}"`);
      }
      updated++;
    }
  }

  console.log(`\n📊 Updated ${updated} tickets`);

  // Show final state
  const updatedTickets = await Ticket.find({})
    .select('jobId clientName consultantName clientEmail')
    .sort({ createdAt: -1 })
    .lean();

  console.log('\n📋 Current tickets:');
  updatedTickets.forEach(t => {
    const clientMatch = clientMap[t.clientEmail?.toLowerCase()];
    const source = clientMatch ? '(DB)' : '(Email)';
    console.log(`   ${t.jobId} | Client: ${t.clientName} | Consultant: ${t.consultantName || '-'} ${source}`);
  });

  await mongoose.disconnect();
  console.log('\n🔌 Done');
}

restoreNames().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
