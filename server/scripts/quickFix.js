require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// Helper function to get client name (use "Client Name" field first)
const getClientName = (client) => {
  if (!client) return '';

  // Priority 1: Use "Client Name" field (e.g., "Abbott")
  const clientName = client['Client Name'];
  if (typeof clientName === 'string' && clientName.trim()) {
    return clientName.trim();
  }

  // Priority 2: Use "Account Name" field
  const accountName = client['Account Name'];
  if (typeof accountName === 'string' && accountName.trim()) {
    return accountName.trim();
  }

  // Priority 3: Fall back to First Name + Last Name
  const firstName = client['First Name'];
  const lastName = client['Last Name'];
  const fn = (typeof firstName === 'string') ? firstName.trim() : '';
  const ln = (typeof lastName === 'string') ? lastName.trim() : '';
  return (fn + ' ' + ln).trim();
};

async function fixTickets() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to:', mongoose.connection.db.databaseName);

  const ticketsCol = mongoose.connection.db.collection('tickets');
  const clientsCol = mongoose.connection.db.collection('Client');

  // Get all tickets
  const tickets = await ticketsCol.find({}).toArray();
  console.log('Found', tickets.length, 'tickets to check\n');

  let fixed = 0;

  for (const ticket of tickets) {
    const email = ticket.clientEmail ? ticket.clientEmail.toLowerCase() : '';
    if (!email) continue;

    // Find client by email (case-insensitive)
    const client = await clientsCol.findOne({
      'Email': { $regex: new RegExp('^' + email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }
    });

    if (client) {
      const rawConsultant = client['Consultant Name'];
      const dbConsultantName = (typeof rawConsultant === 'string') ? rawConsultant.trim() : '';
      const dbClientName = getClientName(client);

      // Update ticket
      await ticketsCol.updateOne(
        { _id: ticket._id },
        { $set: {
          consultantName: dbConsultantName,
          clientName: dbClientName
        }}
      );
      console.log('✅', ticket.jobId, '-> Client:', dbClientName, '| Consultant:', dbConsultantName);
      fixed++;
    } else {
      // Clear Auto-generated if no match
      if (ticket.consultantName === 'Auto-generated') {
        await ticketsCol.updateOne(
          { _id: ticket._id },
          { $set: { consultantName: '' }}
        );
        console.log('🧹', ticket.jobId, '-> Cleared (no client match for', email + ')');
        fixed++;
      } else {
        console.log('⏭️', ticket.jobId, '-> No client match for', email);
      }
    }
  }

  console.log('\n✅ Fixed', fixed, 'tickets');
  await mongoose.disconnect();
}

fixTickets().catch(console.error);
