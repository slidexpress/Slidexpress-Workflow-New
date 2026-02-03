const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getClientModel, getClientName, findClientByEmail, findClientsByEmails } = require('../models/Client');
const { JobCounter, getNextJobId, getCurrentCounter, setCounter } = require('../models/JobCounter');

// ─────────────────────────────────────────────
// GET ALL CLIENTS (from test.Client collection)
// ─────────────────────────────────────────────
router.get(
  '/',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const ClientModel = await getClientModel();
      const clients = await ClientModel.find({})
        .sort({ 'Client Name': 1 })
        .lean();

      // Transform to consistent format (derive clientName from First Name + Last Name)
      const formattedClients = clients.map(c => ({
        _id: c._id,
        email: c['Email'] || '',
        clientName: getClientName(c),  // Derived from First Name + Last Name
        consultantName: c['Consultant Name'] || '',
        accountName: c['Account Name'] || '',
        jobCode: c['Job Code'] || '',  // e.g., "ABT" for Abbott -> generates "ABT-400248"
        firstName: c['First Name'] || '',
        lastName: c['Last Name'] || ''
      }));

      res.json({ clients: formattedClients });
    } catch (err) {
      console.error('Error fetching clients:', err);
      res.status(500).json({ message: 'Failed to fetch clients', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// STATUS - Check test.Client collection connection
// (Must be before /:id to avoid being matched as an ID)
// ─────────────────────────────────────────────
router.get(
  '/status',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      console.log('🔍 Checking test.Client collection status...');

      const ClientModel = await getClientModel();
      const count = await ClientModel.countDocuments();

      // Get sample clients
      const samples = await ClientModel.find({}).limit(5).lean();
      const sampleList = samples.map(c => ({
        email: c['Email'],
        clientName: getClientName(c),  // Derived from First Name + Last Name
        consultantName: c['Consultant Name']
      }));

      console.log(`✅ test.Client collection has ${count} clients`);

      res.json({
        connected: true,
        database: 'test',
        collection: 'Client',
        clientCount: count,
        sampleClients: sampleList
      });
    } catch (err) {
      console.error('❌ Failed to check client status:', err);
      res.status(500).json({
        connected: false,
        error: err.message
      });
    }
  }
);

// ─────────────────────────────────────────────
// TEST LOOKUP FROM EXTERNAL test.Client COLLECTION
// (Must be before /:id to avoid being matched as an ID)
// ─────────────────────────────────────────────
router.get(
  '/lookup/:email',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const email = req.params.email;
      console.log(`🔍 Testing client lookup for email: ${email}`);

      const client = await findClientByEmail(email);

      if (client) {
        const derivedClientName = getClientName(client);
        console.log(`✅ Found client in test.Client collection:`, {
          '_id': client._id,
          'Account Name': client['Account Name'],
          'Client Name (derived)': derivedClientName,
          'Consultant Name': client['Consultant Name'],
          'Email': client['Email']
        });

        res.json({
          found: true,
          client: {
            _id: client._id,
            accountName: client['Account Name'],
            clientName: derivedClientName,  // Derived from First Name + Last Name
            consultantName: client['Consultant Name'],
            email: client['Email'],
            jobCode: client['Job Code'] || '',
            firstName: client['First Name'],
            lastName: client['Last Name']
          }
        });
      } else {
        console.log(`❌ No client found for email: ${email}`);
        res.json({
          found: false,
          message: `No client found for email: ${email}`,
          hint: 'Add this email to the test.Client collection with "Email", "Client Name", and "Consultant Name" fields'
        });
      }
    } catch (err) {
      console.error('Error in client lookup:', err);
      res.status(500).json({ message: 'Failed to lookup client', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// GET SINGLE CLIENT (from test.Client collection)
// ─────────────────────────────────────────────
router.get(
  '/:id',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      // Check if :id is an email address for lookup
      if (req.params.id.includes('@')) {
        const client = await findClientByEmail(req.params.id);
        if (!client) {
          return res.status(404).json({ message: 'Client not found' });
        }
        res.json({
          client: {
            _id: client._id,
            email: client['Email'] || '',
            clientName: getClientName(client),  // Derived from First Name + Last Name
            consultantName: client['Consultant Name'] || '',
            accountName: client['Account Name'] || '',
            jobCode: client['Job Code'] || '',
            firstName: client['First Name'] || '',
            lastName: client['Last Name'] || ''
          }
        });
        return;
      }

      // Lookup by MongoDB ID
      const ClientModel = await getClientModel();
      const client = await ClientModel.findById(req.params.id).lean();

      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      res.json({
        client: {
          _id: client._id,
          email: client['Email'] || '',
          clientName: getClientName(client),  // Derived from First Name + Last Name
          consultantName: client['Consultant Name'] || '',
          accountName: client['Account Name'] || '',
          jobCode: client['Job Code'] || '',
          firstName: client['First Name'] || '',
          lastName: client['Last Name'] || ''
        }
      });
    } catch (err) {
      console.error('Error fetching client:', err);
      res.status(500).json({ message: 'Failed to fetch client', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// CREATE CLIENT (in test.Client collection)
// ─────────────────────────────────────────────
router.post(
  '/',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { email, clientName, consultantName, accountName, jobCode, firstName, lastName } = req.body;

      if (!email || !clientName) {
        return res.status(400).json({ message: 'Email and client name are required' });
      }

      // Check if client with this email already exists
      const existingClient = await findClientByEmail(email);
      if (existingClient) {
        return res.status(400).json({ message: 'Client with this email already exists' });
      }

      const ClientModel = await getClientModel();
      const client = new ClientModel({
        'Email': email.toLowerCase().trim(),
        'Client Name': clientName.trim(),
        'Consultant Name': consultantName?.trim() || '',
        'Account Name': accountName?.trim() || '',
        'Job Code': jobCode?.trim() || '',
        'First Name': firstName?.trim() || '',
        'Last Name': lastName?.trim() || ''
      });

      await client.save();
      console.log(`✅ Created client in test.Client: ${clientName} (${email})`);

      res.status(201).json({
        client: {
          _id: client._id,
          email: client['Email'],
          clientName: client['Client Name'],
          consultantName: client['Consultant Name'],
          accountName: client['Account Name'],
          jobCode: client['Job Code'] || ''
        },
        message: 'Client created successfully'
      });
    } catch (err) {
      console.error('Error creating client:', err);
      if (err.code === 11000) {
        return res.status(400).json({ message: 'Client with this email already exists' });
      }
      res.status(500).json({ message: 'Failed to create client', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// UPDATE CLIENT (in test.Client collection)
// ─────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { email, clientName, consultantName, accountName, jobCode, firstName, lastName } = req.body;

      const updateData = {};

      if (email) updateData['Email'] = email.toLowerCase().trim();
      if (clientName) updateData['Client Name'] = clientName.trim();
      if (consultantName !== undefined) updateData['Consultant Name'] = consultantName?.trim() || '';
      if (accountName !== undefined) updateData['Account Name'] = accountName?.trim() || '';
      if (jobCode !== undefined) updateData['Job Code'] = jobCode?.trim() || '';
      if (firstName !== undefined) updateData['First Name'] = firstName?.trim() || '';
      if (lastName !== undefined) updateData['Last Name'] = lastName?.trim() || '';

      const ClientModel = await getClientModel();
      const client = await ClientModel.findByIdAndUpdate(
        req.params.id,
        { $set: updateData },
        { new: true }
      ).lean();

      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      console.log(`✅ Updated client in test.Client: ${client['Client Name']} (${client['Email']})`);
      res.json({
        client: {
          _id: client._id,
          email: client['Email'],
          clientName: client['Client Name'],
          consultantName: client['Consultant Name'],
          accountName: client['Account Name'],
          jobCode: client['Job Code'] || ''
        },
        message: 'Client updated successfully'
      });
    } catch (err) {
      console.error('Error updating client:', err);
      if (err.code === 11000) {
        return res.status(400).json({ message: 'Client with this email already exists' });
      }
      res.status(500).json({ message: 'Failed to update client', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// DELETE CLIENT (from test.Client collection)
// ─────────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const ClientModel = await getClientModel();
      const client = await ClientModel.findByIdAndDelete(req.params.id);

      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }

      console.log(`🗑️ Deleted client from test.Client: ${client['Client Name']} (${client['Email']})`);
      res.json({ message: 'Client deleted successfully' });
    } catch (err) {
      console.error('Error deleting client:', err);
      res.status(500).json({ message: 'Failed to delete client', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// BULK IMPORT CLIENTS (to test.Client collection)
// ─────────────────────────────────────────────
router.post(
  '/bulk',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { clients } = req.body;

      if (!Array.isArray(clients) || clients.length === 0) {
        return res.status(400).json({ message: 'Clients array is required' });
      }

      const ClientModel = await getClientModel();

      const operations = clients
        .filter(c => c.email && c.clientName)
        .map(c => ({
          updateOne: {
            filter: {
              'Email': { $regex: new RegExp(`^${c.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            },
            update: {
              $set: {
                'Client Name': c.clientName.trim(),
                'Consultant Name': c.consultantName?.trim() || '',
                'Account Name': c.accountName?.trim() || '',
                'Job Code': c.jobCode?.trim() || '',
                'First Name': c.firstName?.trim() || '',
                'Last Name': c.lastName?.trim() || ''
              },
              $setOnInsert: {
                'Email': c.email.toLowerCase().trim()
              }
            },
            upsert: true
          }
        }));

      if (operations.length > 0) {
        const result = await ClientModel.bulkWrite(operations, { ordered: false });
        console.log(`✅ Bulk import to test.Client: ${result.upsertedCount} created, ${result.modifiedCount} updated`);
        res.json({
          message: 'Bulk import completed',
          created: result.upsertedCount,
          updated: result.modifiedCount
        });
      } else {
        res.status(400).json({ message: 'No valid clients to import' });
      }
    } catch (err) {
      console.error('Error bulk importing clients:', err);
      res.status(500).json({ message: 'Failed to import clients', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// FIX ALL TICKETS - Update client names and consultant names from test.Client
// Uses Account Name for Client column and Consultant Name for Consultant column
// ─────────────────────────────────────────────
router.post(
  '/fix-tickets',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      console.log('🔧 Fixing client names and consultant names in all tickets...');

      const Ticket = require('../models/Ticket');

      // Get all tickets
      const tickets = await Ticket.find({}).lean();
      console.log(`📋 Found ${tickets.length} tickets to check`);

      // Get unique emails
      const ticketEmails = [...new Set(tickets.map(t => t.clientEmail?.toLowerCase()).filter(Boolean))];

      // Batch lookup all clients
      const clients = await findClientsByEmails(ticketEmails);

      // Create lookup map
      const clientMap = {};
      clients.forEach(c => {
        if (c['Email']) {
          clientMap[c['Email'].toLowerCase()] = c;
        }
      });

      let fixedClientNames = 0;
      let fixedConsultantNames = 0;
      let updated = 0;

      for (const ticket of tickets) {
        const clientEmail = ticket.clientEmail?.toLowerCase();
        if (!clientEmail) continue;

        const client = clientMap[clientEmail];
        const currentClientName = ticket.clientName || '';
        const currentConsultant = ticket.consultantName || '';

        if (client) {
          // Get Account Name for client (company name like "Abbott")
          const dbClientName = getClientName(client);  // Now prioritizes Account Name
          const dbConsultantName = client['Consultant Name']?.trim() || '';

          const needsUpdate = {};
          let hasChanges = false;

          // Update client name if different and database has a valid value
          if (dbClientName && dbClientName.trim() !== '' && currentClientName !== dbClientName) {
            needsUpdate.clientName = dbClientName;
            hasChanges = true;
            fixedClientNames++;
            console.log(`   📝 ${ticket.jobId}: Client "${currentClientName}" → "${dbClientName}"`);
          }

          // Update consultant name if different
          if (currentConsultant !== dbConsultantName) {
            needsUpdate.consultantName = dbConsultantName;
            hasChanges = true;
            fixedConsultantNames++;
            console.log(`   📝 ${ticket.jobId}: Consultant "${currentConsultant}" → "${dbConsultantName}"`);
          }

          if (hasChanges) {
            await Ticket.updateOne({ _id: ticket._id }, { $set: needsUpdate });
            updated++;
          }
        } else if (currentConsultant === 'Auto-generated') {
          // Clear invalid consultant name if no client found
          await Ticket.updateOne(
            { _id: ticket._id },
            { $set: { consultantName: '' } }
          );
          fixedConsultantNames++;
          updated++;
        }
      }

      console.log(`✅ Fixed ${fixedClientNames} client names, ${fixedConsultantNames} consultant names`);
      console.log(`✅ Total ${updated} tickets updated`);

      res.json({
        message: 'Tickets fixed successfully',
        fixedClientNames,
        fixedConsultantNames,
        totalUpdated: updated,
        totalChecked: tickets.length,
        clientsFound: clients.length
      });
    } catch (err) {
      console.error('Error fixing tickets:', err);
      res.status(500).json({ message: 'Failed to fix tickets', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// SET JOB CODE BY CLIENT NAME (Quick helper)
// ─────────────────────────────────────────────
router.post(
  '/set-job-code',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { clientName, jobCode } = req.body;

      if (!clientName || !jobCode) {
        return res.status(400).json({ message: 'clientName and jobCode are required' });
      }

      const ClientModel = await getClientModel();

      // Find client by name (case-insensitive)
      const result = await ClientModel.updateMany(
        { 'Client Name': { $regex: new RegExp(`^${clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { $set: { 'Job Code': jobCode.toUpperCase().trim() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: `No clients found with name: ${clientName}` });
      }

      console.log(`✅ Set Job Code "${jobCode}" for ${result.modifiedCount} client(s) named "${clientName}"`);
      res.json({
        message: `Set Job Code "${jobCode}" for ${result.modifiedCount} client(s)`,
        modifiedCount: result.modifiedCount
      });
    } catch (err) {
      console.error('Error setting job code:', err);
      res.status(500).json({ message: 'Failed to set job code', error: err.message });
    }
  }
);

// ─────────────────────────────────────────────
// JOB COUNTERS - View and manage sequential job ID counters
// ─────────────────────────────────────────────

// Get all job counters
router.get(
  '/job-counters',
  authenticate,
  authorize('workflow_coordinator', 'it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const counters = await JobCounter.find({}).sort({ jobCode: 1 }).lean();
      res.json({
        counters: counters.map(c => ({
          jobCode: c.jobCode,
          lastNumber: c.lastNumber,
          nextJobId: `${c.jobCode}-${String(c.lastNumber + 1).padStart(3, '0')}`
        }))
      });
    } catch (err) {
      console.error('Error fetching job counters:', err);
      res.status(500).json({ message: 'Failed to fetch job counters', error: err.message });
    }
  }
);

// Set a specific job counter value
router.put(
  '/job-counters/:jobCode',
  authenticate,
  authorize('it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const { jobCode } = req.params;
      const { value } = req.body;

      if (typeof value !== 'number' || value < 0) {
        return res.status(400).json({ message: 'Value must be a non-negative number' });
      }

      await setCounter(jobCode, value);
      const current = await getCurrentCounter(jobCode);

      console.log(`✅ Set job counter ${jobCode} to ${value}`);
      res.json({
        jobCode: jobCode.toUpperCase(),
        lastNumber: current,
        nextJobId: `${jobCode.toUpperCase()}-${String(current + 1).padStart(3, '0')}`,
        message: 'Counter updated successfully'
      });
    } catch (err) {
      console.error('Error setting job counter:', err);
      res.status(500).json({ message: 'Failed to set job counter', error: err.message });
    }
  }
);

// Initialize counters from existing tickets
router.post(
  '/job-counters/init',
  authenticate,
  authorize('it_admin', 'super_admin'),
  async (req, res) => {
    try {
      const Ticket = require('../models/Ticket');

      // Get all tickets
      const tickets = await Ticket.find({}, { jobId: 1 }).lean();

      // Parse job IDs and find highest number per job code
      const counters = {};

      for (const ticket of tickets) {
        if (!ticket.jobId) continue;

        const match = ticket.jobId.match(/^([A-Z]+)-(\d+)$/i);
        if (!match) continue;

        const [, code, numberStr] = match;
        const number = parseInt(numberStr, 10);
        const jobCode = code.toUpperCase();

        if (!counters[jobCode] || number > counters[jobCode]) {
          counters[jobCode] = number;
        }
      }

      // Initialize counters in database
      for (const [code, number] of Object.entries(counters)) {
        await setCounter(code, number);
      }

      // Get all counters
      const allCounters = await JobCounter.find({}).sort({ jobCode: 1 }).lean();

      console.log(`✅ Initialized ${Object.keys(counters).length} job counters from ${tickets.length} tickets`);
      res.json({
        message: 'Job counters initialized from existing tickets',
        ticketsScanned: tickets.length,
        countersInitialized: Object.keys(counters).length,
        counters: allCounters.map(c => ({
          jobCode: c.jobCode,
          lastNumber: c.lastNumber,
          nextJobId: `${c.jobCode}-${String(c.lastNumber + 1).padStart(3, '0')}`
        }))
      });
    } catch (err) {
      console.error('Error initializing job counters:', err);
      res.status(500).json({ message: 'Failed to initialize job counters', error: err.message });
    }
  }
);

module.exports = router;
