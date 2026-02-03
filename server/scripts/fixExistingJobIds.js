/**
 * FIX EXISTING TICKETS - Update Job IDs using domain-based matching
 *
 * This script:
 * 1. Gets all tickets sorted by creation date
 * 2. Looks up client by email (with domain fallback)
 * 3. Generates proper sequential Job IDs (ABT001, ABT002, etc.)
 * 4. Updates tickets and linked emails
 *
 * Usage:
 *   Dry run:  node scripts/fixExistingJobIds.js --dry-run
 *   Execute:  node scripts/fixExistingJobIds.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const isDryRun = process.argv.includes('--dry-run');

async function fixJobIds() {
  console.log('=============================================');
  console.log('  FIX EXISTING TICKET JOB IDs');
  console.log('=============================================');
  console.log(isDryRun ? '>>> DRY RUN - No changes will be made <<<\n' : '\n');

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database\n');

    const Ticket = require('../models/Ticket');
    const Email = require('../models/Email');
    const { findClientByEmail, getClientName, getJobCodeForClient, generateJobCodeFromName } = require('../models/Client');
    const { setCounter } = require('../models/JobCounter');

    // Step 1: Get all tickets sorted by creation date (oldest first)
    console.log('Step 1: Fetching all tickets...');
    const tickets = await Ticket.find({}).sort({ createdAt: 1 }).lean();
    console.log(`   Found ${tickets.length} tickets\n`);

    if (tickets.length === 0) {
      console.log('No tickets to fix.');
      await mongoose.disconnect();
      return;
    }

    // Step 2: Process each ticket
    console.log('Step 2: Processing tickets...\n');

    const counters = {};  // Track counter per Job Code
    const updates = [];   // Store all updates to make

    for (const ticket of tickets) {
      const email = ticket.clientEmail?.toLowerCase();

      // Look up client (with domain fallback)
      const client = email ? await findClientByEmail(email) : null;

      // Get Job Code from DB or generate from name
      let jobCode;
      let clientName = ticket.clientName;

      if (client) {
        clientName = getClientName(client) || ticket.clientName;
        jobCode = getJobCodeForClient(client, clientName);
      } else {
        // No client found - generate from ticket's client name
        jobCode = generateJobCodeFromName(clientName);
      }

      // Initialize counter if needed
      if (!counters[jobCode]) {
        counters[jobCode] = 0;
      }
      counters[jobCode]++;

      // Generate new Job ID
      const newJobId = `${jobCode}${String(counters[jobCode]).padStart(3, '0')}`;
      const oldJobId = ticket.jobId;

      updates.push({
        ticketId: ticket._id,
        oldJobId,
        newJobId,
        jobCode,
        clientName,
        clientEmail: email
      });

      // Show progress
      const status = oldJobId === newJobId ? '(no change)' : `${oldJobId} → ${newJobId}`;
      console.log(`   ${newJobId.padEnd(8)} | ${(clientName || 'Unknown').substring(0, 20).padEnd(20)} | ${status}`);
    }

    // Step 3: Summary
    console.log('\n--- SUMMARY ---');
    console.log('Job Code Distribution:');
    Object.entries(counters).sort((a, b) => b[1] - a[1]).forEach(([code, count]) => {
      console.log(`   ${code.padEnd(6)}: ${count} tickets`);
    });

    const changedCount = updates.filter(u => u.oldJobId !== u.newJobId).length;
    console.log(`\nTickets to update: ${changedCount}`);

    // Step 4: Apply changes
    if (isDryRun) {
      console.log('\n>>> DRY RUN COMPLETE - No changes made <<<');
      console.log('Run without --dry-run to apply changes.');
    } else {
      console.log('\nStep 3: Applying changes...');

      let ticketsUpdated = 0;
      let emailsUpdated = 0;

      for (const u of updates) {
        // Update ticket
        await Ticket.updateOne(
          { _id: u.ticketId },
          { $set: { jobId: u.newJobId } }
        );
        ticketsUpdated++;

        // Update linked emails
        if (u.oldJobId && u.oldJobId !== u.newJobId) {
          const result = await Email.updateMany(
            { jobId: u.oldJobId },
            { $set: { jobId: u.newJobId } }
          );
          emailsUpdated += result.modifiedCount;
        }
      }

      // Update counters in database
      console.log('\nStep 4: Updating counters...');
      for (const [code, count] of Object.entries(counters)) {
        await setCounter(code, count);
        console.log(`   ${code}: ${count}`);
      }

      console.log('\n=============================================');
      console.log('  COMPLETE');
      console.log('=============================================');
      console.log(`   Tickets updated: ${ticketsUpdated}`);
      console.log(`   Emails updated:  ${emailsUpdated}`);
    }

    // Verification
    console.log('\n--- VERIFICATION ---');
    const verifyTickets = await Ticket.find({}).select('jobId clientName clientEmail').lean();
    verifyTickets.forEach(t => {
      console.log(`   ${(t.jobId || '-').padEnd(8)} | ${(t.clientName || 'N/A').substring(0, 25)}`);
    });

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

fixJobIds();
