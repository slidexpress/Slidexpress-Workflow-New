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
app.use('/api/clients', require('./routes/clients'));

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
// Also creates tickets automatically from starred emails
// ============================================================
const { fetchStarredEmails, saveEmailsToDatabase } = require('./services/emailService');
const { findClientsByEmails, getClientName } = require('./models/Client');
const { getNextJobId } = require('./models/JobCounter');
const User = require('./models/User');
const Ticket = require('./models/Ticket');
const Email = require('./models/Email');

let isSyncing = false;
let lastSyncTime = null;

// Helper to clean up email sender names
const cleanName = (name) => {
  if (!name) return '';
  let cleaned = name.replace(/['"]/g, '').trim();
  // Remove email part like "<email@domain.com>"
  cleaned = cleaned.replace(/<[^>]*>?.*$/, '').trim();
  // Remove "(via Google...)" suffix
  cleaned = cleaned.replace(/\s*\(via\s+Google.*\)$/i, '').trim();
  return cleaned;
};

// Extract company name from email domain
const getCompanyFromDomain = (email) => {
  if (!email) return 'Unknown';
  const domain = email.split('@')[1];
  if (!domain) return 'Unknown';
  let company = domain.split('.')[0];
  company = company.charAt(0).toUpperCase() + company.slice(1);
  return company;
};

const autoSync = async () => {
  if (isSyncing) {
    console.log('⏳ Sync already in progress, skipping...');
    return;
  }

  try {
    isSyncing = true;

    // Get a coordinator user for workspace info
    const coordinator = await User.findOne({ role: 'workflow_coordinator' }).lean();
    if (!coordinator) {
      console.log('⚠️ No workflow_coordinator found for auto-sync');
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

    if (emails.length === 0) {
      console.log(`✅ [AUTO-SYNC] No starred emails found`);
      lastSyncTime = new Date();
      return;
    }

    // Save emails to database
    await saveEmailsToDatabase(emails);
    console.log(`📧 [AUTO-SYNC] Saved ${emails.length} emails to database`);

    // Get client info for auto-filling Client Name and Consultant
    const validEmails = emails.filter(e => e.messageId?.trim());
    const senderEmails = [...new Set(validEmails.map(e => e.from?.address?.toLowerCase()).filter(Boolean))];
    const clients = await findClientsByEmails(senderEmails);

    const clientMap = {};
    clients.forEach(c => {
      if (c.Email) clientMap[c.Email.toLowerCase()] = c;
    });

    // Prepare tickets
    // IMPORTANT: Email sender = Consultant, Company = Client
    const ticketsToCreate = await Promise.all(validEmails.map(async (e) => {
      const senderEmail = e.from?.address?.toLowerCase();
      const client = clientMap[senderEmail];

      let clientName, consultantName, clientType, jobCode;
      if (client) {
        // Found in database - use database values
        clientName = getClientName(client);  // Company name from DB
        consultantName = client['Consultant Name']?.trim() || '';
        clientType = null;  // Existing client
        jobCode = client['Job Code']?.trim() || 'JOB';  // Use client's Job Code
      } else {
        // Not in database - sender is consultant, derive company from domain
        consultantName = cleanName(e.from?.name) || '';  // Sender = Consultant
        clientName = getCompanyFromDomain(e.from?.address);  // Domain = Company
        clientType = 'New';  // Mark as new client
        jobCode = 'JOB';  // Default for unknown clients
      }

      // Generate sequential Job ID using client's Job Code (e.g., ABT-001, ABT-002)
      const jobId = await getNextJobId(jobCode);

      return {
        jobId,
        clientName,
        consultantName,
        clientEmail: e.from.address,
        subject: e.subject || '(No Subject)',
        status: 'not_assigned',
        createdBy: coordinator.email || 'System',
        workspace: coordinator.workspace,
        messageId: e.messageId,
        threadId: e.threadId,
        emailUid: e.uid,
        createdAt: e.date || new Date(),
        emailBodyHtml: e.body?.html || '',
        emailBodyText: e.body?.text || '',
        message: e.body?.text || e.body?.html || '',
        attachments: e.attachments || [],
        hasAttachments: (e.attachments || []).length > 0,
        meta: { clientType: clientType }  // "New" if not in database
      };
    }));

    // Create tickets - unique index prevents duplicates
    let created = 0;
    try {
      const result = await Ticket.insertMany(ticketsToCreate, { ordered: false });
      created = result.length;
    } catch (err) {
      if (err.code === 11000 || err.insertedDocs) {
        created = err.insertedDocs?.length || 0;
      } else {
        throw err;
      }
    }

    // Link emails to tickets
    if (created > 0) {
      const createdTickets = await Ticket.find({
        workspace: coordinator.workspace,
        messageId: { $in: validEmails.map(e => e.messageId) }
      }).select('jobId messageId').lean();

      const bulkOps = createdTickets.map(t => ({
        updateOne: {
          filter: { messageId: t.messageId, workspace: coordinator.workspace },
          update: { $set: { jobId: t.jobId, isStarred: false } }
        }
      }));

      if (bulkOps.length) await Email.bulkWrite(bulkOps, { ordered: false });
      console.log(`✅ [AUTO-SYNC] Created ${created} new tickets`);
    } else {
      console.log(`✅ [AUTO-SYNC] No new tickets (all already exist)`);
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
