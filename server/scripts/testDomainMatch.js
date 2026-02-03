require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);

  const { findClientByEmail } = require('../models/Client');

  const testEmails = [
    'laura.amoros@abbott.com',
    'unknown.person@abbott.com',
    'test@silverbaton.com',
    'random@unknowndomain.com'
  ];

  console.log('=== DOMAIN MATCHING TEST ===\n');

  for (const email of testEmails) {
    console.log('Looking up:', email);
    const client = await findClientByEmail(email);

    if (client) {
      console.log('  FOUND -> Job Code:', client['Job Code '], '| Client:', client['Client Name']);
    } else {
      console.log('  NOT FOUND -> will use default JOB code');
    }
    console.log('');
  }

  await mongoose.disconnect();
}
test();
