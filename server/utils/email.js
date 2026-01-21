const nodemailer = require('nodemailer');

// ============================================================
// SENDGRID API - Primary (Free: 100 emails/day, works everywhere)
// ============================================================
const sendWithSendGrid = async (mailOptions) => {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM || process.env.EMAIL_USER;

  if (!apiKey) {
    throw new Error('SENDGRID_API_KEY not configured');
  }

  const toEmail = Array.isArray(mailOptions.to) ? mailOptions.to[0] : mailOptions.to;

  const payload = {
    personalizations: [{ to: [{ email: toEmail }] }],
    from: { email: fromEmail },
    subject: mailOptions.subject,
    content: [{
      type: 'text/html',
      value: mailOptions.html || mailOptions.text || '<p>No content</p>'
    }]
  };

  // Add attachments if present
  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    payload.attachments = mailOptions.attachments
      .filter(att => att && att.content)
      .slice(0, 5) // Limit to 5 attachments to avoid size issues
      .map(att => {
        try {
          let base64Content;
          if (Buffer.isBuffer(att.content)) {
            base64Content = att.content.toString('base64');
          } else if (att.content.type === 'Buffer' && Array.isArray(att.content.data)) {
            base64Content = Buffer.from(att.content.data).toString('base64');
          } else if (typeof att.content === 'string') {
            base64Content = att.content;
          } else {
            base64Content = Buffer.from(att.content).toString('base64');
          }
          return {
            filename: att.filename || 'attachment',
            content: base64Content,
            type: att.contentType || 'application/octet-stream',
            disposition: 'attachment'
          };
        } catch (e) {
          console.warn(`⚠️ Skipping attachment: ${e.message}`);
          return null;
        }
      })
      .filter(Boolean);
  }

  console.log(`📧 SendGrid: Sending to ${toEmail}...`);

  // Add timeout to fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`❌ SendGrid Error: ${response.status} - ${errorBody}`);
      throw new Error(`SendGrid: ${response.status} - ${errorBody}`);
    }

    console.log(`✅ SendGrid: Email sent successfully to ${toEmail}`);
    return { success: true, provider: 'sendgrid' };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('SendGrid: Request timeout');
    }
    throw err;
  }
};

// ============================================================
// BREVO API - Fallback option
// ============================================================
const sendWithBrevo = async (mailOptions) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER;
  const senderName = process.env.BREVO_SENDER_NAME || 'Slidexpress Workflow';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY not configured');
  }

  const toEmail = Array.isArray(mailOptions.to) ? mailOptions.to[0] : mailOptions.to;

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: toEmail.split('@')[0] }],
    subject: mailOptions.subject,
    htmlContent: mailOptions.html || mailOptions.text || '<p>No content</p>'
  };

  // Skip attachments for Brevo to avoid issues
  console.log(`📧 Brevo: Sending to ${toEmail}...`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Brevo: ${response.status} - ${errorBody}`);
    }

    console.log(`✅ Brevo: Email sent successfully`);
    return { success: true, provider: 'brevo' };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Brevo: Request timeout');
    }
    throw err;
  }
};

// ============================================================
// MAIN EMAIL SENDER - Tries providers in order (NO SMTP - API only)
// ============================================================
const sendEmail = async (mailOptions) => {
  const errors = [];

  console.log(`\n📨 ====== SENDING EMAIL ======`);
  console.log(`📧 To: ${mailOptions.to}`);
  console.log(`📋 Subject: ${mailOptions.subject}`);

  // Provider 1: SendGrid (FREE - 100/day, works on Vercel/Render)
  if (process.env.SENDGRID_API_KEY) {
    try {
      return await sendWithSendGrid(mailOptions);
    } catch (err) {
      errors.push(err.message);
      console.warn(`⚠️ SendGrid failed: ${err.message}`);
    }
  }

  // Provider 2: Brevo (fallback)
  if (process.env.BREVO_API_KEY) {
    try {
      return await sendWithBrevo(mailOptions);
    } catch (err) {
      errors.push(err.message);
      console.warn(`⚠️ Brevo failed: ${err.message}`);
    }
  }

  // All failed - NO SMTP fallback (causes timeouts)
  const errorMsg = errors.length > 0
    ? `Email failed: ${errors.join('; ')}`
    : 'No email provider configured (set SENDGRID_API_KEY)';
  console.error(`❌ ${errorMsg}`);
  throw new Error(errorMsg);
};

// ============================================================
// EXPORTED FUNCTIONS
// ============================================================

// Send OTP email
exports.sendOTPEmail = async (email, otp, purpose) => {
  const subject = purpose === 'first_login'
    ? 'Welcome! Reset Your Password - Slidexpress Workflow'
    : 'Password Reset OTP - Slidexpress Workflow';

  const message = purpose === 'first_login'
    ? `<h2>Welcome to Slidexpress Workflow!</h2>
       <p>This is your first login. Please use the following OTP to reset your password:</p>
       <h1 style="color: #4CAF50;">${otp}</h1>
       <p>This OTP will expire in 10 minutes.</p>`
    : `<h2>Password Reset Request</h2>
       <p>Use this OTP to reset your password:</p>
       <h1 style="color: #4CAF50;">${otp}</h1>
       <p>This OTP will expire in 10 minutes.</p>`;

  try {
    const result = await sendEmail({
      to: email,
      subject,
      html: message
    });
    return { success: true, provider: result.provider };
  } catch (error) {
    console.error('OTP Email error:', error.message);
    return { success: false, error: error.message };
  }
};

// Send assignment email with attachments
exports.sendAssignmentEmail = async (recipientEmail, ticketData, attachments = [], originalEmail = null) => {
  const { jobId, clientName, consultantName, teamLead, deadline, timezone } = ticketData;

  console.log(`\n📧 ====== PREPARING ASSIGNMENT EMAIL ======`);
  console.log(`📧 Recipient: ${recipientEmail}`);
  console.log(`📋 Job ID: ${jobId}`);

  const subject = `New Task Assigned - Job ID: ${jobId}`;

  // Build forwarded email section (simplified - no IMAP fetch)
  let clientEmailSection = '';
  if (originalEmail) {
    const originalDate = originalEmail.date ? new Date(originalEmail.date).toLocaleString() : 'N/A';
    const originalFrom = originalEmail.from
      ? (originalEmail.from.name ? `${originalEmail.from.name} &lt;${originalEmail.from.address}&gt;` : originalEmail.from.address)
      : 'N/A';
    const originalSubject = originalEmail.subject || '(No Subject)';

    let emailBody = '';
    if (originalEmail.body?.html && originalEmail.body.html.trim()) {
      emailBody = originalEmail.body.html;
    } else if (originalEmail.body?.text && originalEmail.body.text.trim()) {
      emailBody = originalEmail.body.text.replace(/\n/g, '<br>');
    } else {
      emailBody = '<p style="color: #888;">Original email content available in the system.</p>';
    }

    clientEmailSection = `
      <div style="margin: 30px 0; padding: 15px 0; border-top: 1px solid #ddd;">
        <p style="font-weight: bold;">---------- Forwarded message ---------</p>
        <p><b>From:</b> ${originalFrom}</p>
        <p><b>Date:</b> ${originalDate}</p>
        <p><b>Subject:</b> ${originalSubject}</p>
        <div style="margin: 15px 0; padding: 10px; border-left: 3px solid #2563eb;">
          ${emailBody}
        </div>
      </div>
    `;
  }

  const message = `
    <div style="font-family: Arial, sans-serif;">
      <h2>New Task Assigned</h2>
      <p>Hello,</p>
      <p>You have been assigned a new task:</p>
      <div style="margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 5px;">
        <p><b>Job ID:</b> ${jobId || 'N/A'}</p>
        <p><b>Client:</b> ${clientName || 'N/A'}</p>
        <p><b>Consultant:</b> ${consultantName || 'N/A'}</p>
        <p><b>Team Lead:</b> ${teamLead || 'N/A'}</p>
        ${deadline ? `<p><b>Deadline:</b> <span style="color: #d00;">${new Date(deadline).toLocaleString()}</span></p>` : ''}
        ${timezone ? `<p><b>Timezone:</b> ${timezone}</p>` : ''}
      </div>
      ${clientEmailSection}
      <p style="margin-top: 20px;">Please review and start working on the task.</p>
      <hr style="margin: 20px 0;" />
      <p style="color: #666; font-size: 11px;">Automated email from Slidexpress Workflow System.</p>
    </div>
  `;

  // Skip attachments to avoid timeout issues - send text only
  try {
    const result = await sendEmail({
      to: recipientEmail,
      subject,
      html: message,
      attachments: [] // Skip attachments for now to ensure delivery
    });

    console.log(`✅ Assignment email sent to ${recipientEmail} via ${result.provider}`);
    return { success: true, provider: result.provider };
  } catch (error) {
    console.error(`❌ Assignment email failed: ${error.message}`);
    return { success: false, error: error.message };
  }
};
