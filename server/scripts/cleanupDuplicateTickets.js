/**
 * Cleanup Duplicate Tickets Script
 *
 * This script removes duplicate tickets that were created from the same email.
 * It keeps the oldest ticket (first created) and deletes the duplicates.
 *
 * Usage: node server/scripts/cleanupDuplicateTickets.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function cleanupDuplicates() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/slidexpress';
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const Ticket = require('../models/Ticket');

    // Find all duplicate messageIds (same email created multiple tickets)
    console.log('\nFinding duplicate tickets...');

    const duplicates = await Ticket.aggregate([
      // Only consider tickets with messageId
      { $match: { messageId: { $ne: null, $exists: true } } },
      // Group by messageId + workspace
      {
        $group: {
          _id: { messageId: '$messageId', workspace: '$workspace' },
          count: { $sum: 1 },
          tickets: {
            $push: {
              ticketId: '$_id',
              jobId: '$jobId',
              createdAt: '$createdAt',
              clientName: '$clientName'
            }
          }
        }
      },
      // Only keep groups with more than 1 ticket (duplicates)
      { $match: { count: { $gt: 1 } } },
      // Sort by count descending
      { $sort: { count: -1 } }
    ]);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate tickets found. Database is clean.');
      await mongoose.disconnect();
      return;
    }

    console.log(`\nFound ${duplicates.length} email(s) with duplicate tickets:\n`);

    let totalDuplicates = 0;
    const ticketsToDelete = [];

    for (const dup of duplicates) {
      // Sort tickets by createdAt to keep the oldest one
      const sortedTickets = dup.tickets.sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
      );

      const keepTicket = sortedTickets[0];
      const deleteTickets = sortedTickets.slice(1);

      console.log(`📧 Email MessageId: ${dup._id.messageId.substring(0, 50)}...`);
      console.log(`   Client: ${keepTicket.clientName}`);
      console.log(`   Total tickets: ${dup.count}`);
      console.log(`   ✓ Keeping: ${keepTicket.jobId} (created: ${keepTicket.createdAt})`);
      console.log(`   ✗ Deleting: ${deleteTickets.map(t => t.jobId).join(', ')}`);
      console.log('');

      totalDuplicates += deleteTickets.length;
      ticketsToDelete.push(...deleteTickets.map(t => t.ticketId));
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Unique emails with duplicates: ${duplicates.length}`);
    console.log(`   - Total duplicate tickets to delete: ${totalDuplicates}`);
    console.log(`   - Tickets to keep: ${duplicates.length}`);

    // Delete the duplicates
    if (ticketsToDelete.length > 0) {
      console.log(`\n🗑️  Deleting ${ticketsToDelete.length} duplicate tickets...`);

      const result = await Ticket.deleteMany({
        _id: { $in: ticketsToDelete }
      });

      console.log(`✅ Successfully deleted ${result.deletedCount} duplicate tickets.`);
    }

    // Rebuild unique index
    console.log('\n🔧 Ensuring unique index on workspace+messageId...');
    try {
      await Ticket.collection.createIndex(
        { workspace: 1, messageId: 1 },
        { unique: true, sparse: true, background: true }
      );
      console.log('✅ Unique index created/verified.');
    } catch (indexErr) {
      if (indexErr.code === 11000) {
        console.log('⚠️  Could not create unique index - there may still be duplicates. Run this script again.');
      } else {
        console.log('⚠️  Index creation note:', indexErr.message);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Cleanup complete. Database disconnected.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

cleanupDuplicates();
