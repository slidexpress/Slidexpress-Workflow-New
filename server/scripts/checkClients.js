require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/slidexpress');

  // List all collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('All collections:');
  collections.forEach(c => console.log('  - ' + c.name));

  // Check if clients collection exists
  const clientsExists = collections.some(c => c.name === 'clients');
  if (clientsExists) {
    const clients = await mongoose.connection.db.collection('clients').find({}).limit(5).toArray();
    console.log('\nSample clients:');
    clients.forEach(c => {
      console.log('  Email: ' + (c.email || c.clientEmail || 'N/A'));
      console.log('  Client Name: ' + (c.clientName || c.name || 'N/A'));
      console.log('  Consultant: ' + (c.consultantName || c.consultant || 'N/A'));
      console.log('  ---');
    });

    // Show schema (first document keys)
    if (clients.length > 0) {
      console.log('\nClient document structure:');
      console.log(JSON.stringify(clients[0], null, 2));
    }
  } else {
    console.log('\n❌ No "clients" collection found');
  }

  await mongoose.disconnect();
}

check().catch(console.error);
