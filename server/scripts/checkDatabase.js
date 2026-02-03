require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/slidexpress';
  console.log('Connecting to:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  await mongoose.connect(uri);

  // List all collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('\nCollections in database:');
  for (const col of collections) {
    const count = await mongoose.connection.db.collection(col.name).countDocuments();
    console.log('  ' + col.name + ': ' + count + ' documents');
  }

  // Check tickets collection directly
  console.log('\n--- Direct tickets collection check ---');
  const ticketsDocs = await mongoose.connection.db.collection('tickets').find({}).limit(5).toArray();
  console.log('Sample tickets (raw):');
  ticketsDocs.forEach(t => {
    console.log('  ' + (t.jobId || 'no-jobId') + ' | ' + (t.clientName || 'no-client'));
  });

  await mongoose.disconnect();
}

check().catch(console.error);
