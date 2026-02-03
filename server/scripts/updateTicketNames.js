/**
 * Update tickets with correct Client Name and Consultant Name from Client database
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Ticket = require('../models/Ticket');
const Email = require('../models/Email');
const { findClientByEmail, getClientName } = require('../models/Client');

// Helper: Format "FirstName LastName" as "LastName, FirstName"
// If already has comma, assume it's already formatted correctly
const formatNameLastFirst = (name) => {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();

  // Already has comma? Assume correct format, just clean it
  if (trimmed.includes(',')) {
    return trimmed.replace(/,+$/, '').replace(/,\s*,/g, ',');
  }

  // Split by spaces - assume "FirstName LastName" order
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];

  // Last word is last name, rest is first name
  const lastName = parts.pop();
  const firstName = parts.join(' ');
  return `${lastName}, ${firstName}`;
};

async function updateTickets() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const tickets = await Ticket.find({}).lean();
    console.log(`\n📋 Found ${tickets.length} tickets to update\n`);

    let updated = 0;
    let noMatch = 0;

    for (const ticket of tickets) {
      const clientEmail = ticket.clientEmail;
      if (!clientEmail) continue;

      const client = await findClientByEmail(clientEmail);

      if (client) {
        const clientName = getClientName(client);
        const consultantName = client['Consultant Name']?.trim() || '-';

        await Ticket.findByIdAndUpdate(ticket._id, {
          clientName: clientName || ticket.clientName,
          consultantName: consultantName
        });

        console.log(`✅ ${ticket.jobId}: ${clientName} | Consultant: ${consultantName}`);
        updated++;
      } else {
        // No match - get original sender name from email
        let senderName = '';
        if (ticket.messageId) {
          const email = await Email.findOne({ messageId: ticket.messageId }).lean();
          if (email?.from?.name) {
            senderName = email.from.name;
          }
        }

        const formattedName = senderName ? formatNameLastFirst(senderName) : clientEmail;

        await Ticket.findByIdAndUpdate(ticket._id, {
          clientName: formattedName,
          consultantName: '-'
        });
        console.log(`⚠️ ${ticket.jobId}: ${formattedName} | Consultant: -`);
        noMatch++;
      }
    }

    console.log(`\n✅ Done! Updated: ${updated}, No match: ${noMatch}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

updateTickets();
