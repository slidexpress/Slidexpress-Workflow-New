/**
 * Cleanup Script: Remove duplicates and fix "Auto-generated"
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Ticket = require('../models/Ticket');

async function cleanup() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Fix "Auto-generated" consultant names
    const fixResult = await Ticket.updateMany(
      { consultantName: 'Auto-generated' },
      { $set: { consultantName: '' } }
    );
    console.log(`\n🔧 Fixed ${fixResult.modifiedCount} "Auto-generated" consultant names`);

    // 2. Find and remove duplicate tickets (keep oldest by createdAt)
    const duplicates = await Ticket.aggregate([
      { $match: { messageId: { $ne: null, $exists: true } } },
      { $group: {
        _id: '$messageId',
        count: { $sum: 1 },
        tickets: { $push: { id: '$_id', jobId: '$jobId', createdAt: '$createdAt' } }
      }},
      { $match: { count: { $gt: 1 } } }
    ]);

    console.log(`\n🔍 Found ${duplicates.length} messageIds with duplicates`);

    let deletedCount = 0;
    for (const dup of duplicates) {
      // Sort by createdAt, keep the oldest
      const sorted = dup.tickets.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const toDelete = sorted.slice(1); // Remove all except first (oldest)

      for (const ticket of toDelete) {
        await Ticket.findByIdAndDelete(ticket.id);
        console.log(`   🗑️ Deleted duplicate: ${ticket.jobId}`);
        deletedCount++;
      }
    }

    console.log(`\n✅ Cleanup complete!`);
    console.log(`   - Fixed Auto-generated: ${fixResult.modifiedCount}`);
    console.log(`   - Deleted duplicates: ${deletedCount}`);

    // Show remaining ticket count
    const totalTickets = await Ticket.countDocuments();
    console.log(`   - Total tickets remaining: ${totalTickets}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

cleanup();
