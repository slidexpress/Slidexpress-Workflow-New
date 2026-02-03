require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const Ticket = require('../models/Ticket');

  await Ticket.updateOne(
    { jobId: 'JOB-668921' },
    { $set: { 'meta.clientType': 'New' } }
  );

  console.log('Fixed JOB-668921: Client Type = New');
  await mongoose.disconnect();
}

fix().catch(console.error);
