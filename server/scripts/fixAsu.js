require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const Ticket = require('../models/Ticket');

  const result = await Ticket.updateOne(
    { clientName: 'Asu' },
    { $set: { clientName: 'Arizona State University' } }
  );

  console.log('Updated:', result.modifiedCount, 'ticket');

  const t = await Ticket.findOne({ clientName: 'Arizona State University' })
    .select('jobId clientName consultantName')
    .lean();

  if (t) {
    console.log(t.jobId, '| Client:', t.clientName, '| Consultant:', t.consultantName);
  }

  await mongoose.disconnect();
}

fix().catch(console.error);
