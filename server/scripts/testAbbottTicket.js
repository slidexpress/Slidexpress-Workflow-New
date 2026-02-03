require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function testAbbottTicket() {
  try {
    console.log('=== TEST ABBOTT TICKET CREATION ===\n');

    // Connect to main database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB\n');

    // Import modules
    const { findClientByEmail } = require('../models/Client');
    const { getNextJobId, getCurrentCounter } = require('../models/JobCounter');

    // Step 1: Look up Abbott client by email
    const testEmail = 'mathias.assantedipanzillo@abbott.com';
    console.log('Step 1: Looking up client by email:', testEmail);

    const client = await findClientByEmail(testEmail);

    if (client) {
      console.log('  Found client!');
      console.log('  Client Name:', client['Client Name']);
      console.log('  Job Code:', client['Job Code ']);  // Note: trailing space
      console.log('  Consultant:', client['Consultant Name']);
    } else {
      console.log('  Client NOT found');
      await mongoose.disconnect();
      return;
    }

    // Step 2: Get the Job Code
    const jobCode = client['Job Code ']?.trim() || 'JOB';
    console.log('\nStep 2: Job Code to use:', jobCode);

    // Step 3: Check current counter
    const currentCount = await getCurrentCounter(jobCode);
    console.log('\nStep 3: Current counter for', jobCode + ':', currentCount);

    // Step 4: Generate next Job ID
    console.log('\nStep 4: Generating Job IDs...');
    const jobId1 = await getNextJobId(jobCode);
    const jobId2 = await getNextJobId(jobCode);
    const jobId3 = await getNextJobId(jobCode);

    console.log('  Generated:', jobId1);
    console.log('  Generated:', jobId2);
    console.log('  Generated:', jobId3);

    // Step 5: Verify format
    console.log('\nStep 5: Format verification');
    const pattern = /^ABT\d{3}$/;
    console.log('  ' + jobId1 + ' matches ABT### format:', pattern.test(jobId1) ? 'YES' : 'NO');

    console.log('\n=== TEST COMPLETE ===');
    console.log('Abbott tickets will be numbered:', jobCode + '001,', jobCode + '002, etc.');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

testAbbottTicket();
