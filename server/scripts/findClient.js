const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const { getClientModel } = require('../models/Client');

async function find() {
  await mongoose.connect(process.env.MONGO_URI);
  const Client = await getClientModel();

  // Search for Amoros
  const results = await Client.find({
    $or: [
      { 'Last Name': /amoros/i },
      { 'First Name': /laura/i },
      { 'Email': /amoros/i },
      { 'Account Name': /amoros/i }
    ]
  }).limit(10).lean();

  console.log(`Found ${results.length} results:`);
  results.forEach(c => {
    console.log(`  - ${c['First Name']} ${c['Last Name']} | ${c['Account Name']} | ${c['Email']} | Consultant: ${c['Consultant Name']}`);
  });

  // Also search for Abbott
  const abbott = await Client.find({
    $or: [
      { 'Email': /abbott/i },
      { 'Account Name': /abbott/i }
    ]
  }).limit(5).lean();

  console.log(`\nAbbott clients (${abbott.length}):`);
  abbott.forEach(c => {
    console.log(`  - ${c['First Name']} ${c['Last Name']} | ${c['Account Name']} | ${c['Email']} | Consultant: ${c['Consultant Name']}`);
  });

  process.exit(0);
}

find();
