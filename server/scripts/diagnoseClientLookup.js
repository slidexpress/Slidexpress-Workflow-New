/**
 * Diagnose client lookup issues
 * Run: node server/scripts/diagnoseClientLookup.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function diagnose() {
  console.log('🔍 DIAGNOSING CLIENT LOOKUP ISSUE\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Connect to main database
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/slidexpress';
  console.log('📦 Connecting to main database...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected\n');

  // Get Client model from test database
  const { getClientModel } = require('../models/Client');
  const Ticket = require('../models/Ticket');

  console.log('🔌 Connecting to test.Client collection...');
  const ClientModel = await getClientModel();
  const clientCount = await ClientModel.countDocuments();
  console.log(`✅ Connected (${clientCount} clients found)\n`);

  // List all clients with their emails
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 CLIENTS IN DATABASE (test.Client collection):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const clients = await ClientModel.find({}).lean();

  if (clients.length === 0) {
    console.log('❌ NO CLIENTS FOUND IN test.Client COLLECTION!');
  } else {
    clients.forEach((c, i) => {
      console.log(`${i + 1}. Email: "${c.Email || '(EMPTY)'}"`);
      console.log(`   Client Name: "${c['Client Name'] || '(EMPTY)'}"`);
      console.log(`   Consultant: "${c['Consultant Name'] || '(EMPTY)'}"`);
      console.log(`   Account: "${c['Account Name'] || '(EMPTY)'}"`);
      console.log('');
    });
  }

  // List recent tickets with their client emails
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 RECENT TICKETS (showing clientEmail for lookup):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tickets = await Ticket.find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  if (tickets.length === 0) {
    console.log('❌ NO TICKETS FOUND!');
  } else {
    // Get all client emails for comparison
    const clientEmails = clients.map(c => c.Email?.toLowerCase()).filter(Boolean);

    tickets.forEach((t, i) => {
      const ticketEmail = t.clientEmail?.toLowerCase();
      const isMatch = ticketEmail && clientEmails.includes(ticketEmail);
      const matchStatus = isMatch ? '✅ MATCH' : '❌ NO MATCH';

      console.log(`${i + 1}. ${t.jobId}`);
      console.log(`   Client Email: "${t.clientEmail || '(EMPTY)'}" ${matchStatus}`);
      console.log(`   Current Client Name: "${t.clientName}"`);
      console.log(`   Current Consultant: "${t.consultantName}"`);
      console.log('');
    });
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DIAGNOSIS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const clientEmailList = clients.map(c => c.Email).filter(Boolean);
  const ticketEmailList = [...new Set(tickets.map(t => t.clientEmail).filter(Boolean))];

  console.log('Client emails in database:');
  clientEmailList.forEach(e => console.log(`   - ${e}`));

  console.log('\nTicket sender emails:');
  ticketEmailList.forEach(e => console.log(`   - ${e}`));

  console.log('\n⚠️  For auto-fill to work, the ticket\'s clientEmail must EXACTLY match');
  console.log('   (case-insensitive) an Email in the Client collection.\n');

  await mongoose.disconnect();
  console.log('🔌 Done');
}

diagnose().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
