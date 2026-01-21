// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const compression = require('compression');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('🚀 MongoDB Connected Successfully');
    // Start auto-sync after DB connection
    startAutoSync();
  })
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/otp', require('./routes/otp'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/team-members', require('./routes/teamMembers'));

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Slidexpress Workflow API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// ============================================================
// AUTO-SYNC: Check Gmail for new starred emails every 30 seconds
// ============================================================
const { fetchStarredEmails, saveEmailsToDatabase } = require('./services/emailService');
const User = require('./models/User');

let isSyncing = false;
let lastSyncTime = null;

const autoSync = async () => {
  if (isSyncing) {
    console.log('⏳ Sync already in progress, skipping...');
    return;
  }

  try {
    isSyncing = true;

    // Get a coordinator user for workspace info
    const coordinator = await User.findOne({ role: 'coordinator' }).lean();
    if (!coordinator) {
      console.log('⚠️ No coordinator found for auto-sync');
      return;
    }

    const email = process.env.EMAIL_USER;
    const password = process.env.EMAIL_PASSWORD;

    if (!email || !password) {
      console.log('⚠️ Email credentials not configured');
      return;
    }

    console.log(`\n🔄 [AUTO-SYNC] Checking Gmail for starred emails...`);

    const emails = await fetchStarredEmails(
      email,
      password,
      coordinator.workspace,
      coordinator._id
    );

    if (emails.length > 0) {
      await saveEmailsToDatabase(emails);
      console.log(`✅ [AUTO-SYNC] Synced ${emails.length} starred emails`);
    } else {
      console.log(`✅ [AUTO-SYNC] No new starred emails`);
    }

    lastSyncTime = new Date();
  } catch (err) {
    console.error(`❌ [AUTO-SYNC] Error: ${err.message}`);
  } finally {
    isSyncing = false;
  }
};

const startAutoSync = () => {
  console.log('🔄 Starting auto-sync (every 30 seconds)...');

  // Initial sync after 5 seconds
  setTimeout(autoSync, 5000);

  // Then sync every 30 seconds
  setInterval(autoSync, 30000);
};

// API to get sync status
app.get('/api/sync-status', (req, res) => {
  res.json({
    isSyncing,
    lastSyncTime,
    autoSyncEnabled: true,
    interval: '30 seconds'
  });
});

// API to trigger manual sync
app.post('/api/sync-now', async (req, res) => {
  if (isSyncing) {
    return res.json({ message: 'Sync already in progress', isSyncing: true });
  }

  autoSync();
  res.json({ message: 'Sync started', isSyncing: true });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
