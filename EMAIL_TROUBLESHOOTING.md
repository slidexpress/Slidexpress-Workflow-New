# Email Troubleshooting Guide

## Issue: "Failed to send assignment emails"

### Quick Checklist

1. **Check Email Configuration** (`.env` file)
   ```
   EMAIL_USER=youremail@gmail.com
   EMAIL_PASSWORD=your_app_password_here
   ```

   - Make sure EMAIL_USER and EMAIL_PASSWORD are set
   - For Gmail, use an App Password (not your regular password)
   - Remove any spaces from the password

2. **Check Team Member Email Addresses**
   - Go to Admin Dashboard → Team Members
   - Verify each team member has an email address configured
   - The email field must be filled in for assignment emails to work

3. **Check Server Console Logs**

   When an assignment email is sent, you should see:
   ```
   📧 ====== ASSIGNMENT EMAIL REQUEST ======
   📧 Ticket ID: ...
   👤 Employee: John Doe
   ✓ Ticket found: JOB-123456
   ✓ Team member found: John Doe
   ✓ Email address: john@example.com
   📧 ====== SENDING ASSIGNMENT EMAIL ======
   ✓ Email sent successfully
   ```

   If you see errors instead, they will tell you what's wrong.

### Common Issues

#### 1. "Team member not found"
**Solution:** The team member doesn't exist in the database. Add them in Admin Dashboard.

#### 2. "Email address not configured"
**Solution:** The team member exists but has no email. Edit the team member and add their email address.

#### 3. "SMTP connection failed"
**Solutions:**
- Check your EMAIL_USER and EMAIL_PASSWORD in `.env`
- For Gmail: Enable 2FA and create an App Password
- Check if your firewall/antivirus is blocking ports 465 or 587
- Try a different email provider

#### 4. "Invalid login credentials"
**Solution:** Your email password is incorrect. For Gmail, use an App Password, not your regular password.

### How to Test Email Sending

1. Start the server:
   ```bash
   cd server
   npm run dev
   ```

2. Assign a ticket to a team member who has an email address

3. Check the server console for detailed logs

4. Check the team member's email inbox (including spam folder)

### Setting up Gmail App Password

1. Go to https://myaccount.google.com/
2. Security → 2-Step Verification (enable if not enabled)
3. Security → App passwords
4. Generate new app password for "Mail"
5. Copy the 16-character password (remove spaces)
6. Add to `.env` file:
   ```
   EMAIL_PASSWORD=abcdefghijklmnop
   ```

### Email Format

Assignment emails are sent with:
- **Subject:** "New Task is Assigned - Job ID: JOB-XXXXX"
- **Body:**
  - Task assignment details (Job ID, Client, Consultant, Team Lead, Deadline)
  - Attachments (if any)
  - Original client email in "We received from client" section

### Still Having Issues?

1. Check server logs for detailed error messages
2. Verify SMTP credentials are correct
3. Try sending a test email manually using the same credentials
4. Check if your email provider requires special settings
5. Make sure ports 465 or 587 are not blocked
