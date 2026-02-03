require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);

  const db = mongoose.connection.client.db('test');

  // Get all tickets
  const tickets = await db.collection('tickets').find({}).toArray();
  console.log('=== TICKETS ===');
  console.log('Total:', tickets.length);
  tickets.forEach(t => {
    console.log(`  ${t.jobId} | ${t.clientName} | ${t.clientEmail}`);
  });

  // Get emails with jobId
  console.log('\n=== EMAILS WITH JOB ID ===');
  const emailsWithJobId = await db.collection('emails').find({ jobId: { $exists: true, $ne: null } }).limit(10).toArray();
  console.log('Found:', emailsWithJobId.length);
  emailsWithJobId.forEach(e => {
    console.log(`  ${e.jobId} | ${(e.subject || '').substring(0, 50)}`);
  });

  await mongoose.disconnect();
}

check();
