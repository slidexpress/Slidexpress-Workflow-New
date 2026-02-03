require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);

  const { findClientByEmail, getClientName } = require('../models/Client');

  const testEmails = [
    'laura.amoros@abbott.com',
    'sergey.mikhno@abbott.com'
  ];

  console.log('=== CLIENT LOOKUP TEST ===\n');

  for (const email of testEmails) {
    console.log('Looking up:', email);
    const client = await findClientByEmail(email);

    if (client) {
      console.log('  FOUND');
      console.log('    Client Name:', client['Client Name']);
      console.log('    Job Code field:', client['Job Code ']);
      console.log('    Consultant:', client['Consultant Name']);
    } else {
      console.log('  NOT FOUND');
    }
    console.log('');
  }

  await mongoose.disconnect();
}

test();
