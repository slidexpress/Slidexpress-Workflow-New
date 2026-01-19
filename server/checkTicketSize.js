const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Ticket = require('./models/Ticket');

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const tickets = await Ticket.find().lean();
    
    console.log('\n📦 TICKET SIZE ANALYSIS:\n');
    tickets.forEach(ticket => {
      const fullSize = JSON.stringify(ticket).length;
      const withoutEmails = JSON.stringify({ ...ticket, emails: undefined }).length;
      const emailsSize = fullSize - withoutEmails;
      
      console.log('Ticket:', ticket.jobId);
      console.log('  Full size:', (fullSize / 1024).toFixed(2), 'KB');
      console.log('  Without emails:', (withoutEmails / 1024).toFixed(2), 'KB');
      console.log('  Emails array:', (emailsSize / 1024).toFixed(2), 'KB');
      console.log('  Email count:', ticket.emails?.length || 0);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

check();
