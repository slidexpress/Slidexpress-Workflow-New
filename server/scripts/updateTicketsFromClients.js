/**
 * Update existing tickets with client/consultant info from test.Client collection
 * Run: node server/scripts/updateTicketsFromClients.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function updateTickets() {
  console.log('🔄 Starting ticket update from test.Client collection...\n');

  // Connect to main database
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/slidexpress';
  console.log('📦 Connecting to main database...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to main database\n');

  // Import the Client helper (connects to test database)
  const { findClientByEmail, getClientModel } = require('../models/Client');
  const Ticket = require('../models/Ticket');

  // Test connection to test.Client collection
  console.log('🔌 Testing connection to test.Client collection...');
  try {
    const ClientModel = await getClientModel();
    const clientCount = await ClientModel.countDocuments();
    console.log(`✅ Connected to test.Client collection (${clientCount} clients)\n`);
  } catch (err) {
    console.error('❌ Failed to connect to test.Client:', err.message);
    await mongoose.disconnect();
    return;
  }

  // Get all tickets
  const tickets = await Ticket.find({}).lean();
  console.log(`📋 Found ${tickets.length} tickets to check\n`);

  let updated = 0;
  let cleared = 0;
  let notMatched = 0;

  for (const ticket of tickets) {
    const clientEmail = ticket.clientEmail?.toLowerCase();

    if (!clientEmail) {
      console.log(`⏭️  ${ticket.jobId}: No client email, skipping`);
      notMatched++;
      continue;
    }

    // Look up client in test.Client collection
    const client = await findClientByEmail(clientEmail);

    if (client) {
      const dbClientName = client['Client Name'];
      const dbConsultantName = client['Consultant Name'];

      // Determine what to update
      let newClientName = ticket.clientName;
      let newConsultantName = ticket.consultantName;

      // Update client name if valid in database
      if (dbClientName && dbClientName.trim() !== '' && dbClientName.trim().toLowerCase() !== 'no name') {
        newClientName = dbClientName.trim();
      }

      // Update consultant name from database
      newConsultantName = dbConsultantName?.trim() || '';

      // Check if update is needed
      if (newClientName !== ticket.clientName || newConsultantName !== ticket.consultantName) {
        await Ticket.updateOne(
          { _id: ticket._id },
          {
            $set: {
              clientName: newClientName,
              consultantName: newConsultantName
            }
          }
        );
        console.log(`✅ ${ticket.jobId}: ${newClientName} | Consultant: ${newConsultantName || '(blank)'}`);
        updated++;
      } else {
        console.log(`⏭️  ${ticket.jobId}: Already up to date`);
      }
    } else {
      // No matching client - clear "Auto-generated" if present
      if (ticket.consultantName === 'Auto-generated' || ticket.consultantName === 'Auto-generated') {
        await Ticket.updateOne(
          { _id: ticket._id },
          { $set: { consultantName: '' } }
        );
        console.log(`🧹 ${ticket.jobId}: Cleared "Auto-generated" (no client match for ${clientEmail})`);
        cleared++;
      } else {
        console.log(`⏭️  ${ticket.jobId}: No client match for ${clientEmail}`);
        notMatched++;
      }
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Summary:`);
  console.log(`   ✅ Updated with client info: ${updated}`);
  console.log(`   🧹 Cleared Auto-generated: ${cleared}`);
  console.log(`   ⏭️  No matching client: ${notMatched}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected from databases');
}

updateTickets().catch(err => {
  console.error('❌ Script error:', err);
  process.exit(1);
});
