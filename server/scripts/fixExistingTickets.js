/**
 * Fix existing tickets - update with client/consultant data from test.Client
 * - Client Name from "Client Name" field only (not Account Name)
 * - Consultant Name from "Consultant Name" field
 * - Don't auto-fill Client Type
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function fixTickets() {
  // Connect main app
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to main database');

  const { findClientsByEmails } = require('../models/Client');
  const Ticket = require('../models/Ticket');

  // Get all tickets
  const tickets = await Ticket.find({}).lean();
  console.log(`Found ${tickets.length} tickets`);

  if (tickets.length === 0) {
    console.log('No tickets to fix');
    await mongoose.disconnect();
    return;
  }

  // Get unique client emails
  const clientEmails = [...new Set(tickets.map(t => t.clientEmail?.toLowerCase()).filter(Boolean))];
  console.log(`Looking up ${clientEmails.length} unique client emails...`);

  // Look up clients
  const clients = await findClientsByEmails(clientEmails);
  console.log(`Found ${clients.length} matching clients`);

  // Create lookup map
  const clientMap = {};
  clients.forEach(c => {
    if (c.Email) {
      clientMap[c.Email.toLowerCase()] = c;
    }
  });

  // Update tickets
  let updated = 0;
  let notFound = 0;

  for (const ticket of tickets) {
    const senderEmail = ticket.clientEmail?.toLowerCase();
    const client = senderEmail ? clientMap[senderEmail] : null;

    if (client) {
      const dbClientName = client['Client Name'];
      const dbConsultantName = client['Consultant Name'];

      // Use Client Name only if it's valid (not "No Name" or empty)
      // Otherwise keep the original clientName from ticket
      let clientName = ticket.clientName;
      if (dbClientName && dbClientName.trim() !== '' && dbClientName.trim().toLowerCase() !== 'no name') {
        clientName = dbClientName.trim();
      }

      const consultantName = dbConsultantName?.trim() || '';

      await Ticket.updateOne(
        { _id: ticket._id },
        {
          $set: {
            clientName: clientName,
            consultantName: consultantName
          },
          $unset: {
            'meta.clientType': ''  // Remove auto-filled client type
          }
        }
      );

      console.log(`✅ ${ticket.jobId}: Client="${clientName}" | Consultant="${consultantName}"`);
      updated++;
    } else {
      // No client found - set consultant to blank if it was "Auto-generated"
      if (ticket.consultantName === 'Auto-generated') {
        await Ticket.updateOne(
          { _id: ticket._id },
          { $set: { consultantName: '' } }
        );
        console.log(`📝 ${ticket.jobId}: Cleared "Auto-generated" (no client match for ${senderEmail})`);
      } else {
        console.log(`⏭️ ${ticket.jobId}: No client match, keeping current data`);
      }
      notFound++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Updated with client data: ${updated}`);
  console.log(`No client found: ${notFound}`);

  await mongoose.disconnect();
  console.log('Done');
}

fixTickets().catch(console.error);
