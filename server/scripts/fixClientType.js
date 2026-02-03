/**
 * Fix Client Type field - set to "New" for emails not in Client database
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to database\n');

  const Ticket = require('../models/Ticket');
  const { findClientsByEmails } = require('../models/Client');

  // Get all tickets
  const tickets = await Ticket.find({}).lean();
  console.log('Checking', tickets.length, 'tickets...\n');

  // Get client emails from database
  const emails = [...new Set(tickets.map(t => t.clientEmail?.toLowerCase()).filter(Boolean))];
  const clients = await findClientsByEmails(emails);
  const clientEmails = new Set(clients.map(c => c.Email?.toLowerCase()).filter(Boolean));

  console.log('Found', clientEmails.size, 'emails in Client database\n');

  let updated = 0;
  for (const t of tickets) {
    const emailInDb = clientEmails.has(t.clientEmail?.toLowerCase());

    if (!emailInDb) {
      // Email NOT in database - set clientType to "New"
      await Ticket.updateOne(
        { _id: t._id },
        { $set: { 'meta.clientType': 'New' } }
      );
      console.log(t.jobId + ': Client Type = New');
      updated++;
    } else {
      // Email IS in database - clear clientType (set to null)
      await Ticket.updateOne(
        { _id: t._id },
        { $set: { 'meta.clientType': null } }
      );
    }
  }

  console.log('\nUpdated', updated, 'tickets with Client Type = New');

  // Verify
  const newTickets = await Ticket.find({ 'meta.clientType': 'New' }).countDocuments();
  console.log('Verification: Found', newTickets, 'tickets with Client Type = New');

  await mongoose.disconnect();
}

fix().catch(console.error);
