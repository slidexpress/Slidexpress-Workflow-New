require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Ticket = require('../models/Ticket');
  const tickets = await Ticket.find({}).sort({ createdAt: -1 }).limit(10).lean();

  console.log('\n📋 RECENT TICKETS - clientEmail vs expected:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  tickets.forEach(t => {
    console.log(`${t.jobId}`);
    console.log(`   clientEmail: "${t.clientEmail}"`);
    console.log(`   clientName: "${t.clientName}"`);
    console.log(`   consultantName: "${t.consultantName}"`);
    console.log('');
  });

  await mongoose.disconnect();
});
