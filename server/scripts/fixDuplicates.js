/**
 * FIX DUPLICATES: Clean database and enforce unique constraint
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const Ticket = require('../models/Ticket');

  // 1. Find and remove duplicates (keep oldest)
  console.log('=== STEP 1: Remove duplicate tickets ===');

  const duplicates = await Ticket.aggregate([
    { $match: { messageId: { $ne: null } } },
    { $group: {
      _id: '$messageId',
      count: { $sum: 1 },
      tickets: { $push: { id: '$_id', jobId: '$jobId', createdAt: '$createdAt' } }
    }},
    { $match: { count: { $gt: 1 } } }
  ]);

  let deleted = 0;
  for (const dup of duplicates) {
    // Sort by createdAt, keep oldest
    const sorted = dup.tickets.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const toDelete = sorted.slice(1);

    for (const t of toDelete) {
      await Ticket.findByIdAndDelete(t.id);
      console.log('  🗑️ Deleted: ' + t.jobId);
      deleted++;
    }
  }
  console.log('  Deleted ' + deleted + ' duplicate tickets\n');

  // 2. Drop old non-unique index and create unique one
  console.log('=== STEP 2: Create UNIQUE index ===');

  try {
    await Ticket.collection.dropIndex('workspace_1_messageId_1');
    console.log('  Dropped old index');
  } catch (e) {
    console.log('  Old index not found or already dropped');
  }

  try {
    await Ticket.collection.createIndex(
      { workspace: 1, messageId: 1 },
      { unique: true, sparse: true, name: 'workspace_messageId_unique' }
    );
    console.log('  ✅ Created UNIQUE index: workspace_messageId_unique');
  } catch (e) {
    console.log('  ⚠️ Index creation error:', e.message);
  }

  // 3. Show final state
  console.log('\n=== FINAL STATE ===');
  const remaining = await Ticket.countDocuments();
  console.log('  Total tickets: ' + remaining);

  const indexes = await Ticket.collection.indexes();
  const uniqueIdx = indexes.find(i => i.name === 'workspace_messageId_unique');
  if (uniqueIdx) {
    console.log('  ✅ Unique index active: ' + uniqueIdx.name);
  } else {
    console.log('  ⚠️ Unique index NOT found!');
  }

  process.exit(0);
}

fix().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
