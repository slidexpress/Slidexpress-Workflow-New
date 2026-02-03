/**
 * Force re-sync emails with correct parsing, updating all records
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function resync() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected\n');

  const Email = require('../models/Email');
  const User = require('../models/User');
  const { fetchStarredEmails } = require('../services/emailService');

  const coord = await User.findOne({ role: 'workflow_coordinator' }).lean();

  console.log('Fetching emails from Gmail...');
  const emails = await fetchStarredEmails(
    process.env.EMAIL_USER,
    process.env.EMAIL_PASSWORD,
    coord.workspace,
    coord._id
  );

  console.log('Fetched', emails.length, 'emails\n');

  // Force update each email
  let updated = 0;
  for (const e of emails) {
    if (!e.messageId) continue;

    const result = await Email.updateOne(
      { messageId: e.messageId },
      {
        $set: {
          'from.name': e.from.name,
          'from.address': e.from.address,
          subject: e.subject,
          date: e.date,
          isStarred: true,
          workspace: e.workspace
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log('Updated:', e.from.address, '|', e.from.name);
      updated++;
    }
  }

  console.log('\n✅ Updated', updated, 'emails');

  // Verify
  const sample = await Email.find({}).select('from.name from.address').limit(5).lean();
  console.log('\nVerification:');
  sample.forEach(e => console.log('  ', e.from?.address, '|', e.from?.name));

  await mongoose.disconnect();
}

resync().catch(console.error);
