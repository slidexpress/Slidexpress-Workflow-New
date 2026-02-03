/**
 * Fix ticket names:
 * - Clean up messy names like "Kathryn Scheckel <Kathryn.Schecke"
 * - Email sender = Consultant (not Client)
 * - Client = Company name from database or email domain
 *
 * Run: node server/scripts/fixTicketNames.js
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

// Check if a name looks like a real person name (not just a domain/company)
const isRealName = (name) => {
  if (!name) return false;
  const cleaned = name.trim().toLowerCase();
  // If it contains a space, likely a real name
  if (cleaned.includes(' ')) return true;
  // If it contains < or @, it's an email format - could have a name before it
  if (name.includes('<') || name.includes('@')) return true;
  // Single word that's capitalized like a name (not all lowercase domain)
  if (/^[A-Z][a-z]+$/.test(name.trim())) return true;
  return false;
};

// Extract company name from email domain
const getCompanyFromEmail = (email) => {
  if (!email) return 'Unknown';
  const domain = email.split('@')[1];
  if (!domain) return 'Unknown';
  // Remove common suffixes
  let company = domain.split('.')[0];
  // Capitalize
  company = company.charAt(0).toUpperCase() + company.slice(1);
  return company;
};

async function fixTickets() {
  console.log('\n🔧 ====== FIX TICKET NAMES ======\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to database\n');

  const Ticket = require('../models/Ticket');
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
      newClientName = getClientName(client);  // Company name
      newConsultantName = client['Consultant Name']?.trim() || '';
    } else {
      // Not in database - need to figure out consultant name from existing data
      // Priority: 1) existing consultantName if it looks like a real name
      //           2) clientName if it looks like a real name (might have sender info)
      //           3) fall back to empty

      let senderName = '';

      // First check consultantName - if it has a real name (even messy), clean it
      if (ticket.consultantName && isRealName(ticket.consultantName)) {
        senderName = cleanName(ticket.consultantName);
      }
      // If consultantName was empty/domain, check clientName for sender info
      else if (ticket.clientName && isRealName(ticket.clientName)) {
        senderName = cleanName(ticket.clientName);
      }

      newConsultantName = senderName;  // Sender = Consultant
      newClientName = getCompanyFromEmail(ticket.clientEmail);  // Domain = Company
    }

    // Don't overwrite a good consultant name with empty or domain-like value
    const existingConsultantCleaned = cleanName(ticket.consultantName || '');
    if (existingConsultantCleaned && !newConsultantName) {
      // Keep existing consultant name if new one is empty
      newConsultantName = existingConsultantCleaned;
    }

    // Check if update needed
    const needsUpdate =
      ticket.clientName !== newClientName ||
      ticket.consultantName !== newConsultantName;

    if (needsUpdate) {
      await Ticket.updateOne(
        { _id: ticket._id },
        { $set: { clientName: newClientName, consultantName: newConsultantName } }
      );
      console.log(`✅ ${ticket.jobId}:`);
      console.log(`   Client: "${ticket.clientName}" → "${newClientName}"`);
      console.log(`   Consultant: "${ticket.consultantName || '-'}" → "${newConsultantName || '-'}"`);
      updated++;
    }
  }

  console.log(`\n📊 Updated ${updated} tickets`);

  // Show final state
  const updatedTickets = await Ticket.find({}).select('jobId clientName consultantName').sort({ createdAt: -1 }).lean();
  console.log('\n📋 Current tickets:');
  updatedTickets.forEach(t => {
    console.log(`   ${t.jobId} | Client: ${t.clientName} | Consultant: ${t.consultantName || '-'}`);
  });

  await mongoose.disconnect();
  console.log('\n🔌 Done');
}

fixTickets().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
