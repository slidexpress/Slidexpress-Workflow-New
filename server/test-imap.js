// Test IMAP connection to Gmail
require('dotenv').config();
const Imap = require('imap');

console.log('========================================');
console.log('Testing Gmail IMAP Connection');
console.log('========================================\n');

// Check environment variables
const email = process.env.EMAIL_USER;
const password = process.env.EMAIL_PASSWORD;

console.log('1. Checking environment variables...');
console.log(`   EMAIL_USER: ${email ? '✓ Found' : '✗ Missing'}`);
console.log(`   EMAIL_PASSWORD: ${password ? '✓ Found' : '✗ Missing'}`);

if (!email || !password) {
  console.error('\n❌ ERROR: EMAIL_USER or EMAIL_PASSWORD not found in .env file');
  console.log('\nPlease add these to your server/.env file:');
  console.log('EMAIL_USER=your-email@gmail.com');
  console.log('EMAIL_PASSWORD=your-app-password');
  process.exit(1);
}

// Remove spaces from password (Gmail app passwords often have spaces)
const cleanedPassword = password.replace(/\s+/g, '');

console.log('\n2. IMAP Configuration:');
console.log(`   Email: ${email}`);
console.log(`   Password: ${'*'.repeat(cleanedPassword.length)}`);
console.log(`   Host: imap.gmail.com`);
console.log(`   Port: 993 (SSL/TLS)`);

// Create IMAP connection
const imap = new Imap({
  user: email,
  password: cleanedPassword,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  connTimeout: 10000,
  authTimeout: 10000
});

console.log('\n3. Attempting IMAP connection...');

imap.once('ready', () => {
  console.log('✅ IMAP connection successful!\n');

  imap.openBox('INBOX', true, (err, box) => {
    if (err) {
      console.error('❌ Error opening INBOX:', err.message);
      imap.end();
      process.exit(1);
    }

    console.log('✅ Successfully opened INBOX');
    console.log(`   Total messages: ${box.messages.total}`);
    console.log(`   New messages: ${box.messages.new}`);

    // Check for starred emails
    imap.search(['FLAGGED'], (err, results) => {
      if (err) {
        console.error('❌ Error searching for starred emails:', err.message);
        imap.end();
        process.exit(1);
      }

      console.log(`   Starred emails: ${results.length}`);

      console.log('\n========================================');
      console.log('✅ Gmail IMAP is working correctly!');
      console.log('========================================\n');

      if (results.length === 0) {
        console.log('⚠️  Note: No starred emails found.');
        console.log('   Please star some emails in Gmail to test email sync.\n');
      }

      imap.end();
      process.exit(0);
    });
  });
});

imap.once('error', (err) => {
  console.error('\n❌ IMAP Connection Error:');
  console.error(`   ${err.message}\n`);

  // Provide specific troubleshooting guidance
  if (err.message.includes('Invalid credentials') || err.message.includes('AUTHENTICATIONFAILED')) {
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   1. This is a Google Workspace email (@mecstudio.com)');
    console.log('   2. Make sure IMAP is enabled:');
    console.log('      - Go to Gmail Settings → Forwarding and POP/IMAP');
    console.log('      - Enable IMAP access');
    console.log('   3. Generate a new App Password:');
    console.log('      - Go to Google Account → Security → 2-Step Verification');
    console.log('      - Scroll down to "App passwords"');
    console.log('      - Generate a new password for "Mail"');
    console.log('      - Update EMAIL_PASSWORD in server/.env');
    console.log('   4. If using Google Workspace:');
    console.log('      - Admin may need to enable IMAP for the organization');
    console.log('      - Contact your Google Workspace administrator\n');
  } else if (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNREFUSED')) {
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   1. Check your internet connection');
    console.log('   2. Check if firewall is blocking port 993');
    console.log('   3. Try disabling VPN if you\'re using one\n');
  } else {
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   1. Verify email and password in server/.env');
    console.log('   2. Make sure IMAP is enabled in Gmail');
    console.log('   3. Try generating a new App Password\n');
  }

  process.exit(1);
});

imap.once('end', () => {
  console.log('IMAP connection closed.');
});

console.log('   Connecting...');
imap.connect();
