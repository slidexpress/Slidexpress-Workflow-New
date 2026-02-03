require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function testLookup() {
  const uri = process.env.MONGO_URI;
  console.log('Using URI:', uri ? uri.substring(0, 30) + '...' : 'UNDEFINED');

  // Connect main app
  await mongoose.connect(uri);
  console.log('Connected to main database');

  const { findClientsByEmails, getClientModel } = require('../models/Client');

  // Get Client model (connects to test database)
  const Client = await getClientModel();

  // Count clients
  const count = await Client.countDocuments();
  console.log(`\nTotal clients in test.Client: ${count}`);

  // Show 5 sample clients
  const samples = await Client.find({}).limit(5).lean();
  console.log('\nSample clients:');
  samples.forEach(c => {
    console.log(`  Email: ${c.Email}`);
    console.log(`  Client Name: ${c['Client Name']}`);
    console.log(`  Consultant: ${c['Consultant Name']}`);
    console.log(`  Account: ${c['Account Name']}`);
    console.log('  ---');
  });

  // Test lookup by email
  console.log('\n--- Testing email lookup ---');
  const testEmails = ['nathalie@10digits.io', 'mkeefe@10fold.com', 'nonexistent@test.com'];

  const found = await findClientsByEmails(testEmails);
  console.log(`Found ${found.length} clients for ${testEmails.length} emails:`);
  found.forEach(c => {
    console.log(`  ✓ ${c.Email} → ${c['Client Name']} | ${c['Consultant Name']}`);
  });

  await mongoose.disconnect();
}

testLookup().catch(console.error);
