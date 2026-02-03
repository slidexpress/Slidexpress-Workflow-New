const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Ticket = require('../models/Ticket');

  const tickets = await Ticket.find({}).select('jobId clientEmail messageId subject createdAt').lean();

  console.log('=== ALL TICKETS (' + tickets.length + ') ===');
  tickets.forEach(t => {
    const msgId = t.messageId ? t.messageId.substring(0,30) + '...' : 'NULL';
    console.log(t.jobId + ' | ' + (t.clientEmail || 'N/A').substring(0,25) + ' | ' + msgId);
  });

  // Find duplicates by messageId
  const msgIdCounts = {};
  tickets.forEach(t => {
    if (t.messageId) {
      msgIdCounts[t.messageId] = (msgIdCounts[t.messageId] || 0) + 1;
    }
  });

  const duplicates = Object.entries(msgIdCounts).filter(([k,v]) => v > 1);
  console.log('\n=== DUPLICATE messageIds: ' + duplicates.length + ' ===');
  duplicates.forEach(([msgId, count]) => {
    console.log('  ' + msgId.substring(0,40) + '... : ' + count + ' tickets');
  });

  // Check for NULL messageIds
  const nullMsgIds = tickets.filter(t => t.messageId === null || t.messageId === undefined);
  console.log('\n=== TICKETS WITHOUT messageId: ' + nullMsgIds.length + ' ===');
  nullMsgIds.forEach(t => console.log('  ' + t.jobId));

  // Check indexes
  const indexes = await Ticket.collection.indexes();
  console.log('\n=== INDEXES ===');
  indexes.forEach(idx => {
    console.log('  ' + idx.name + ': ' + JSON.stringify(idx.key) + (idx.unique ? ' [UNIQUE]' : ''));
  });

  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
