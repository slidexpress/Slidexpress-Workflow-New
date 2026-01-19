const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Ticket = require('./models/Ticket');
const Email = require('./models/Email');

async function countData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const ticketCount = await Ticket.countDocuments();
    const emailCount = await Email.countDocuments();

    console.log('\n📊 DATABASE STATISTICS:');
    console.log('═'.repeat(50));
    console.log('Total Tickets:', ticketCount);
    console.log('Total Emails:', emailCount);
    console.log('═'.repeat(50));

    // Check for tickets with large emails array
    const ticketsWithManyEmails = await Ticket.aggregate([
      { $project: { jobId: 1, emailCount: { $size: { $ifNull: ['$emails', []] } } } },
      { $match: { emailCount: { $gt: 0 } } },
      { $sort: { emailCount: -1 } },
      { $limit: 10 }
    ]);

    if (ticketsWithManyEmails.length > 0) {
      console.log('\n⚠️  TICKETS WITH LARGE EMAILS ARRAYS:');
      ticketsWithManyEmails.forEach(t => {
        console.log('   ' + t.jobId + ': ' + t.emailCount + ' emails');
      });
    }

    // Estimate data size
    const sampleTicket = await Ticket.findOne().lean();
    if (sampleTicket) {
      const avgSize = JSON.stringify(sampleTicket).length;
      const estimatedTotalSize = (avgSize * ticketCount) / (1024 * 1024);
      console.log('\n💾 Estimated total size: ' + estimatedTotalSize.toFixed(2) + ' MB');

      if (estimatedTotalSize > 50) {
        console.log('⚠️  WARNING: Database is very large! Consider archiving old tickets.');
      }
    }

    // Check for very large individual tickets
    console.log('\n🔍 Checking for oversized tickets...');
    const allTickets = await Ticket.find().select('jobId emails message').lean();
    let largeTickets = [];

    allTickets.forEach(ticket => {
      const size = JSON.stringify(ticket).length / 1024; // KB
      if (size > 100) {
        largeTickets.push({ jobId: ticket.jobId, size: size.toFixed(2) });
      }
    });

    if (largeTickets.length > 0) {
      console.log('⚠️  LARGE TICKETS FOUND (> 100KB each):');
      largeTickets.sort((a, b) => parseFloat(b.size) - parseFloat(a.size));
      largeTickets.slice(0, 10).forEach(t => {
        console.log('   ' + t.jobId + ': ' + t.size + ' KB');
      });
      console.log('\n💡 TIP: These tickets have large emails arrays or messages.');
      console.log('   Excluding them with .select("-emails -message") is CRITICAL!');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

countData();
