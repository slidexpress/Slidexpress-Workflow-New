require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function check() {
  const uri = process.env.MONGO_URI.replace(/\/?(\?|$)/, '/test$1');
  await mongoose.connect(uri);

  // Find all Momentum Partners clients
  const clients = await mongoose.connection.db.collection('Client').find({
    $or: [
      { 'Client Name': /momentum/i },
      { 'Email': /momentumpartners/i }
    ]
  }).toArray();

  console.log('=== MOMENTUM PARTNERS IN DATABASE ===\n');
  console.log('Found:', clients.length, 'records\n');

  clients.forEach(c => {
    console.log('Client Name:', c['Client Name']);
    console.log('Job Code:', c['Job Code ']);
    console.log('Email:', c['Email']);
    console.log('---');
  });

  await mongoose.disconnect();
}
check();
