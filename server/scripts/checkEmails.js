require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);

  const Email = require('../models/Email');
  const User = require('../models/User');

  const coord = await User.findOne({ role: 'workflow_coordinator' }).lean();
  console.log('Coordinator workspace:', coord.workspace);

  const emails = await Email.find({}).select('workspace isStarred jobId from').lean();

  // Group by workspace
  const byWorkspace = {};
  emails.forEach(e => {
    const ws = String(e.workspace || 'null');
    if (!byWorkspace[ws]) byWorkspace[ws] = { total: 0, starred: 0, available: 0 };
    byWorkspace[ws].total++;
    if (e.isStarred) byWorkspace[ws].starred++;
    if (e.isStarred && !e.jobId) byWorkspace[ws].available++;
  });

  console.log('\nEmails by workspace:');
  Object.keys(byWorkspace).forEach(ws => {
    console.log(`  ${ws}:`);
    console.log(`    Total: ${byWorkspace[ws].total}`);
    console.log(`    Starred: ${byWorkspace[ws].starred}`);
    console.log(`    Available (no ticket): ${byWorkspace[ws].available}`);
  });

  // Check what the API would return
  const coordWs = coord.workspace;
  const apiResult = await Email.find({ workspace: coordWs, isStarred: true })
    .sort({ date: -1 })
    .lean();

  console.log('\nAPI query result (workspace + starred):');
  console.log(`  Would return: ${apiResult.length} emails`);

  await mongoose.disconnect();
}

check().catch(console.error);
