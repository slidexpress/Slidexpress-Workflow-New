require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function checkJobCodes() {
  await mongoose.connect(process.env.MONGO_URI.replace(/\/?(\?|$)/, '/test$1'));

  const Client = mongoose.connection.collection('Client');

  // Count clients with Job Code (note the trailing space in field name)
  const withCode = await Client.countDocuments({ 'Job Code ': { $exists: true, $ne: null, $ne: '' } });
  const total = await Client.countDocuments({});

  console.log('=== JOB CODE STATUS ===');
  console.log('Total clients:', total);
  console.log('With Job Code:', withCode);
  console.log('Without Job Code:', total - withCode);

  // Show sample Job Codes
  console.log('\n=== SAMPLE JOB CODES ===');
  const samples = await Client.find({ 'Job Code ': { $exists: true, $ne: null, $ne: '' } })
    .limit(30)
    .toArray();

  samples.forEach(c => {
    const code = (c['Job Code '] || '-').padEnd(6);
    const name = (c['Client Name'] || 'N/A').substring(0, 30);
    console.log(code + ' | ' + name);
  });

  // Check Abbott specifically
  console.log('\n=== ABBOTT CLIENTS ===');
  const abbotts = await Client.find({ 'Client Name': /abbott/i }).limit(5).toArray();
  abbotts.forEach(c => {
    console.log('Job Code:', c['Job Code '], '| Email:', c['Email']);
  });

  await mongoose.disconnect();
}

checkJobCodes().catch(e => { console.error(e.message); process.exit(1); });
