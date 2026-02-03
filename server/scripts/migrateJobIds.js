/**
 * MIGRATION SCRIPT: Fix all existing Job IDs
 *
 * This script:
 * 1. Finds all tickets with old format (JOB-XXXXXX)
 * 2. Looks up client's Job Code from Client collection
 * 3. Generates new sequential IDs (ABT001, ABT002, etc.)
 * 4. Updates tickets AND linked emails
 *
 * Usage:
 *   Dry run:  node scripts/migrateJobIds.js --dry-run
 *   Execute:  node scripts/migrateJobIds.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const isDryRun = process.argv.includes('--dry-run');

async function migrateJobIds() {
  console.log('=============================================');
  console.log('  JOB ID MIGRATION SCRIPT');
  console.log('=============================================');
  console.log(isDryRun ? '>>> DRY RUN MODE - No changes will be made <<<\n' : '\n');

  try {
    // Connect to main database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to main database\n');

    const Ticket = require('../models/Ticket');
    const Email = require('../models/Email');
    const { getClientModel, findClientByEmail } = require('../models/Client');
    const { setCounter } = require('../models/JobCounter');

    // Initialize Client model (connects to test database)
    await getClientModel();

    // Step 1: Get all tickets
    console.log('Step 1: Fetching all tickets...');
    const allTickets = await Ticket.find({}).lean();
    console.log(`   Found ${allTickets.length} total tickets\n`);

    // Step 2: Group tickets by client email to determine Job Codes
    console.log('Step 2: Analyzing tickets and looking up Job Codes...\n');

    // Track counters per Job Code
    const counters = {};  // { 'ABT': 0, 'JOB': 0, etc. }
    const migrations = []; // Track all migrations to perform

    for (const ticket of allTickets) {
      const clientEmail = ticket.clientEmail?.toLowerCase();

      // Look up client to get Job Code
      let jobCode = 'JOB';  // Default
      if (clientEmail) {
        const client = await findClientByEmail(clientEmail);
        if (client && client['Job Code ']?.trim()) {
          jobCode = client['Job Code '].trim().toUpperCase();
        }
      }

      // Initialize counter for this job code if needed
      if (!counters[jobCode]) {
        counters[jobCode] = 0;
      }
      counters[jobCode]++;

      // Generate new Job ID
      const newJobId = `${jobCode}${String(counters[jobCode]).padStart(3, '0')}`;
      const oldJobId = ticket.jobId;

      migrations.push({
        ticketId: ticket._id,
        oldJobId,
        newJobId,
        jobCode,
        clientName: ticket.clientName,
        clientEmail
      });
    }

    // Step 3: Show summary
    console.log('Step 3: Migration Summary\n');
    console.log('Job Code Counts:');
    Object.entries(counters).sort((a, b) => b[1] - a[1]).forEach(([code, count]) => {
      console.log(`   ${code.padEnd(6)} : ${count} tickets`);
    });

    console.log(`\nTotal tickets to migrate: ${migrations.length}`);

    // Show sample migrations
    console.log('\nSample migrations (first 20):');
    console.log('-'.repeat(70));
    migrations.slice(0, 20).forEach(m => {
      const arrow = m.oldJobId === m.newJobId ? '  (no change)' : ` → ${m.newJobId}`;
      console.log(`   ${(m.oldJobId || 'NULL').padEnd(15)} ${arrow.padEnd(20)} | ${(m.clientName || 'N/A').substring(0, 25)}`);
    });
    if (migrations.length > 20) {
      console.log(`   ... and ${migrations.length - 20} more`);
    }
    console.log('-'.repeat(70));

    // Step 4: Execute migrations
    if (isDryRun) {
      console.log('\n>>> DRY RUN COMPLETE - No changes made <<<');
      console.log('Run without --dry-run to apply changes.');
    } else {
      console.log('\nStep 4: Applying migrations...\n');

      let ticketsUpdated = 0;
      let emailsUpdated = 0;
      let errors = 0;

      for (const m of migrations) {
        try {
          // Update ticket
          await Ticket.updateOne(
            { _id: m.ticketId },
            { $set: { jobId: m.newJobId } }
          );
          ticketsUpdated++;

          // Update linked emails (both by old jobId and by ticket's messageId)
          if (m.oldJobId) {
            const emailResult = await Email.updateMany(
              { jobId: m.oldJobId },
              { $set: { jobId: m.newJobId } }
            );
            emailsUpdated += emailResult.modifiedCount;
          }

          // Progress indicator
          if (ticketsUpdated % 100 === 0) {
            console.log(`   Processed ${ticketsUpdated}/${migrations.length} tickets...`);
          }
        } catch (err) {
          console.error(`   ❌ Error migrating ${m.oldJobId}: ${err.message}`);
          errors++;
        }
      }

      // Step 5: Update counters in database
      console.log('\nStep 5: Updating Job Counters...');
      for (const [code, count] of Object.entries(counters)) {
        await setCounter(code, count);
        console.log(`   ${code}: set to ${count}`);
      }

      // Final summary
      console.log('\n=============================================');
      console.log('  MIGRATION COMPLETE');
      console.log('=============================================');
      console.log(`   Tickets updated: ${ticketsUpdated}`);
      console.log(`   Emails updated:  ${emailsUpdated}`);
      console.log(`   Errors:          ${errors}`);
      console.log('=============================================\n');
    }

    // Verification
    console.log('Verification - Sample tickets after migration:');
    const sampleTickets = await Ticket.find({}).limit(10).select('jobId clientName clientEmail').lean();
    sampleTickets.forEach(t => {
      console.log(`   ${(t.jobId || 'NULL').padEnd(10)} | ${(t.clientName || 'N/A').substring(0, 30)}`);
    });

  } catch (error) {
    console.error('\n❌ MIGRATION ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

migrateJobIds();
