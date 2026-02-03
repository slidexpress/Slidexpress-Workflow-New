require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/slidexpress');
  const Ticket = require('../models/Ticket');

  // Check recent tickets
  const recentTickets = await Ticket.find({})
    .sort({ createdAt: -1 })
    .limit(20)
    .select('jobId clientName messageId threadId createdAt')
    .lean();

  console.log('Recent 20 tickets:');
  recentTickets.forEach(t => {
    const client = t.clientName ? t.clientName.substring(0, 25) : 'N/A';
    const hasMsgId = t.messageId ? 'YES' : 'NULL';
    const hasThreadId = t.threadId ? 'YES' : 'NULL';
    console.log(t.jobId + ' | ' + client.padEnd(25) + ' | msgId: ' + hasMsgId + ' | threadId: ' + hasThreadId);
  });

  // Count tickets with/without messageId
  const withMsgId = await Ticket.countDocuments({ messageId: { $ne: null } });
  const withoutMsgId = await Ticket.countDocuments({ messageId: null });
  const total = await Ticket.countDocuments({});

  console.log('\n--- Summary ---');
  console.log('Total tickets: ' + total);
  console.log('With messageId: ' + withMsgId);
  console.log('Without messageId: ' + withoutMsgId);

  // Check for duplicates by clientName + subject
  console.log('\n--- Checking duplicates by client + similar time ---');
  const duplicatesByClient = await Ticket.aggregate([
    {
      $group: {
        _id: { clientName: '$clientName', subject: '$subject' },
        count: { $sum: 1 },
        jobIds: { $push: '$jobId' }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  if (duplicatesByClient.length > 0) {
    console.log('Found potential duplicates (same client + subject):');
    duplicatesByClient.forEach(d => {
      console.log('  ' + d._id.clientName + ' | Count: ' + d.count + ' | Jobs: ' + d.jobIds.join(', '));
    });
  } else {
    console.log('No duplicates found by client+subject');
  }

  await mongoose.disconnect();
}

check().catch(console.error);
