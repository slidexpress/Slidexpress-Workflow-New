require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);

  const Ticket = require('../models/Ticket');
  const tickets = await Ticket.find({}).sort({ createdAt: -1 }).limit(10).lean();

  console.log('Recent tickets:');
  tickets.forEach(t => {
    console.log(`${t.jobId} | Client: "${t.clientName}" | Consultant: "${t.consultantName}" | Email: ${t.clientEmail}`);
  });

  await mongoose.disconnect();
}
check().catch(console.error);
