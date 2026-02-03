/**
 * Check why emails aren't matching Client database
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected\n');

  const Ticket = require('../models/Ticket');
  const { getClientModel } = require('../models/Client');
  const ClientModel = await getClientModel();

  // Get tickets with "New" client type
  const newTickets = await Ticket.find({ 'meta.clientType': 'New' })
    .select('jobId clientEmail clientName consultantName')
    .lean();

  console.log('Tickets marked as "New":', newTickets.length);
  console.log('─'.repeat(80));

  for (const t of newTickets) {
    const email = t.clientEmail?.toLowerCase();
    console.log('\nTicket:', t.jobId);
    console.log('  Email:', email);
    console.log('  Current Client:', t.clientName);
    console.log('  Current Consultant:', t.consultantName);

    // Try to find in Client database
    const client = await ClientModel.findOne({
      'Email': { $regex: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
    }).lean();

    if (client) {
      console.log('  ✅ FOUND in Client DB:');
      console.log('     Client Name:', client['Client Name']);
      console.log('     Consultant Name:', client['Consultant Name']);
      console.log('     Email in DB:', client['Email']);
    } else {
      // Try partial match
      const partial = await ClientModel.findOne({
        'Email': { $regex: email.split('@')[0], $options: 'i' }
      }).lean();

      if (partial) {
        console.log('  ⚠️ Partial match found:');
        console.log('     DB Email:', partial['Email']);
        console.log('     Client Name:', partial['Client Name']);
      } else {
        console.log('  ❌ NOT FOUND in Client DB');
      }
    }
  }

  await mongoose.disconnect();
}

check().catch(console.error);
