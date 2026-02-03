require('dotenv').config();
const mongoose = require('mongoose');

async function addClients() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/slidexpress');

  const Client = require('../models/Client');
  const Workspace = require('../models/Workspace');

  // Get first workspace
  const workspace = await Workspace.findOne().lean();
  if (!workspace) {
    console.log('❌ No workspace found. Create a workspace first.');
    await mongoose.disconnect();
    return;
  }

  console.log('Using workspace:', workspace.name || workspace._id);

  // Add sample clients - EDIT THESE with your real client data
  const clients = [
    { email: 'patrick@example.com', clientName: 'Patrick Beitel', consultantName: 'John Smith' },
    { email: 'amey@example.com', clientName: 'Amey Sawant', consultantName: 'Jane Doe' },
    { email: 'harry@example.com', clientName: 'Harry Mowbray', consultantName: 'Bob Wilson' },
    // Add more clients here...
  ];

  for (const c of clients) {
    try {
      await Client.findOneAndUpdate(
        { email: c.email.toLowerCase(), workspace: workspace._id },
        {
          $set: {
            clientName: c.clientName,
            consultantName: c.consultantName,
            isActive: true,
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Added/Updated: ${c.clientName} (${c.email})`);
    } catch (err) {
      console.log(`❌ Error: ${c.email} - ${err.message}`);
    }
  }

  const count = await Client.countDocuments({ workspace: workspace._id });
  console.log(`\nTotal clients: ${count}`);

  await mongoose.disconnect();
}

addClients().catch(console.error);
