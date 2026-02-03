const mongoose = require('mongoose');

/**
 * Client Schema - Maps to existing "Client" collection in "test" database
 *
 * Fields in your database:
 * - Client Name: Company/client name (e.g., "Abbott") - PRIMARY field for Client column
 * - Consultant Name: Consultant assigned (e.g., "Mikhno, Sergey")
 * - Email: Client email address for lookup
 * - Account Name: Alternative company name field (fallback)
 * - First Name / Last Name: Contact person (last resort fallback)
 */
const clientSchema = new mongoose.Schema({
  'Client Name': { type: String },
  'Consultant Name': { type: String },
  'Email': { type: String },
  'Account Name': { type: String },
  'First Name': { type: String },
  'Last Name': { type: String },
  'Job Code ': { type: String }  // NOTE: Field has trailing space in DB! e.g., "ABT" for Abbott -> generates "ABT001"
}, {
  collection: 'Client',  // Use existing collection name (case-sensitive)
  strict: false          // Allow other fields
});

// Create a separate connection to the "test" database
let testDbConnection = null;
let ClientModel = null;

const getClientModel = async () => {
  if (ClientModel) return ClientModel;

  // Get base URI and connect to "test" database
  const baseUri = process.env.MONGO_URI || 'mongodb://localhost:27017';

  // For MongoDB Atlas (mongodb+srv://), insert database name before query params
  let testUri;
  if (baseUri.includes('mongodb+srv://')) {
    // Atlas format: mongodb+srv://user:pass@cluster.xxx.mongodb.net/?options
    // Remove trailing slash before ? and add /test
    testUri = baseUri.replace(/\/?(\?|$)/, '/test$1');
  } else {
    // Standard format
    testUri = baseUri.replace(/\/?(\?|$)/, '/test$1');
  }

  try {
    console.log('🔌 Connecting to test database for Client collection...');
    testDbConnection = await mongoose.createConnection(testUri);
    ClientModel = testDbConnection.model('Client', clientSchema);

    // Verify connection by counting documents
    const count = await ClientModel.countDocuments();
    console.log(`✅ Connected to test.Client collection (${count} clients found)`);
    return ClientModel;
  } catch (err) {
    console.error('❌ Failed to connect to test database:', err.message);
    throw err;
  }
};

// Helper function to get client name (PRIORITY: Client Name field)
const getClientName = (client) => {
  if (!client) return '';

  // Priority 1: Use "Client Name" field (e.g., "Abbott")
  const rawClientName = client['Client Name'];
  if (typeof rawClientName === 'string' && rawClientName.trim()) {
    return rawClientName.trim();
  }

  // Priority 2: Use "Account Name" field as fallback
  const rawAccountName = client['Account Name'];
  if (typeof rawAccountName === 'string' && rawAccountName.trim()) {
    return rawAccountName.trim();
  }

  // Priority 3: Fall back to First Name + Last Name ONLY if no Client Name
  const rawFirstName = client['First Name'];
  const rawLastName = client['Last Name'];
  const firstName = (typeof rawFirstName === 'string') ? rawFirstName.trim() : '';
  const lastName = (typeof rawLastName === 'string') ? rawLastName.trim() : '';
  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  return '';
};

// Helper function to generate Job Code from name (first 3 letters, uppercase)
const generateJobCodeFromName = (name) => {
  if (!name) return 'JOB';
  // Remove non-letters and get first 3 characters
  const lettersOnly = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
  let code = lettersOnly.substring(0, 3);
  // Pad with X if less than 3 letters
  while (code.length < 3) {
    code += 'X';
  }
  return code;
};

// Helper function to find client by email (with domain fallback)
const findClientByEmail = async (email) => {
  if (!email) return null;

  try {
    const Client = await getClientModel();

    // First try exact email match
    let client = await Client.findOne({
      'Email': { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).lean();

    if (client) return client;

    // If not found, try domain-based matching (find ANY client with same domain)
    const domain = email.split('@')[1];
    if (domain) {
      client = await Client.findOne({
        'Email': { $regex: new RegExp(`@${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      }).lean();

      if (client) {
        console.log(`   🔗 Domain match: ${email} → ${client['Client Name']}`);
      }
    }

    return client;
  } catch (err) {
    console.error('Error finding client:', err.message);
    return null;
  }
};

// Helper function to get Job Code for a client (from DB or generate from name)
const getJobCodeForClient = (client, fallbackName) => {
  // If client has Job Code in database, use it
  if (client && client['Job Code '] && client['Job Code '].trim()) {
    return client['Job Code '].trim().toUpperCase();
  }

  // Otherwise generate from client name or fallback name
  const name = (client ? getClientName(client) : fallbackName) || fallbackName;
  const generatedCode = generateJobCodeFromName(name);
  console.log(`   📝 Generated Job Code: ${generatedCode} (from "${name}")`);
  return generatedCode;
};

// Helper function to find multiple clients by emails (case-insensitive)
const findClientsByEmails = async (emails) => {
  if (!emails || emails.length === 0) return [];

  try {
    const Client = await getClientModel();

    // Build case-insensitive regex patterns for each email
    const emailPatterns = emails.map(email => ({
      'Email': { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }));

    console.log(`🔍 Searching test.Client for ${emails.length} email(s)...`);
    const clients = await Client.find({
      $or: emailPatterns
    }).lean();

    console.log(`   → Found ${clients.length} matching client(s)`);
    return clients;
  } catch (err) {
    console.error('❌ Error finding clients:', err.message);
    return [];
  }
};

// Helper function to get the contact person name (First + Last name)
// This is separate from getClientName which returns the company/account name
const getContactName = (client) => {
  if (!client) return '';

  const rawFirstName = client['First Name'];
  const rawLastName = client['Last Name'];
  const firstName = (typeof rawFirstName === 'string') ? rawFirstName.trim() : '';
  const lastName = (typeof rawLastName === 'string') ? rawLastName.trim() : '';

  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  return '';
};

module.exports = {
  getClientModel,
  getClientName,
  getContactName,
  findClientByEmail,
  findClientsByEmails,
  getJobCodeForClient,
  generateJobCodeFromName
};
