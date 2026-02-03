require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function check() {
  const uri = process.env.MONGO_URI.replace(/\/?(\?|$)/, '/test$1');
  await mongoose.connect(uri);
  
  const domains = [
    'abbott.com',
    'momentumpartners.ai',
    'silverbaton.com',
    'google.com',
    'clickup.com',
    'fbin.com',
    'eganwine.com',
    'alliantcreditunion.com',
    'procurementsciences.com',
    'mecstudio.com'
  ];
  
  console.log('=== JOB CODES BY DOMAIN ===\n');
  
  for (const domain of domains) {
    const client = await mongoose.connection.db.collection('Client').findOne({
      'Email': { $regex: new RegExp('@' + domain.replace(/\./g, '\.') + '$', 'i') },
      'Job Code ': { $exists: true, $ne: null, $ne: '' }
    });
    
    if (client) {
      console.log(domain.padEnd(25) + ' -> ' + client['Job Code '] + ' (' + client['Client Name'] + ')');
    } else {
      console.log(domain.padEnd(25) + ' -> NO JOB CODE SET');
    }
  }
  
  await mongoose.disconnect();
}
check();
