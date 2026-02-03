/**
 * Initialize Job Counters from Existing Tickets
 *
 * This script scans all existing tickets and initializes the job counters
 * based on the highest job number found for each job code.
 *
 * Run with: node server/scripts/initJobCounters.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function initJobCounters() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/slidexpress';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Import models after connection
    const Ticket = require('../models/Ticket');
    const { JobCounter, setCounter } = require('../models/JobCounter');

    // Get all tickets
    console.log('\nFetching all tickets...');
    const tickets = await Ticket.find({}, { jobId: 1 }).lean();
    console.log(`Found ${tickets.length} tickets`);

    // Parse job IDs and find highest number per job code
    const counters = {};

    for (const ticket of tickets) {
      if (!ticket.jobId) continue;

      // Parse job ID (format: CODE-NUMBER, e.g., "ABT-001" or "JOB-400248")
      const match = ticket.jobId.match(/^([A-Z]+)-(\d+)$/i);
      if (!match) {
        console.log(`  Skipping invalid jobId: ${ticket.jobId}`);
        continue;
      }

      const [, jobCode, numberStr] = match;
      const number = parseInt(numberStr, 10);
      const code = jobCode.toUpperCase();

      if (!counters[code] || number > counters[code]) {
        counters[code] = number;
      }
    }

    // Display found counters
    console.log('\nHighest job numbers found:');
    for (const [code, number] of Object.entries(counters)) {
      console.log(`  ${code}: ${number}`);
    }

    // Initialize counters in database
    console.log('\nInitializing job counters in database...');
    for (const [code, number] of Object.entries(counters)) {
      await setCounter(code, number);
      console.log(`  Set ${code} counter to ${number}`);
    }

    // Show all counters
    console.log('\nCurrent job counters:');
    const allCounters = await JobCounter.find({}).lean();
    for (const counter of allCounters) {
      console.log(`  ${counter.jobCode}: ${counter.lastNumber} (next: ${counter.jobCode}-${String(counter.lastNumber + 1).padStart(3, '0')})`);
    }

    console.log('\nDone!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

initJobCounters();
