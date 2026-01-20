const nodemailer = require('nodemailer');

// Guard rails to avoid silent failures when env is missing/misconfigured
const buildTransporter = (port, secure) => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'; // Allow custom SMTP host

  if (!user || !pass) {
    const error = 'Email credentials are not configured (EMAIL_USER / EMAIL_PASSWORD).';
    console.error(error);
    throw new Error(error);
  }

  // Remove spaces from password (Gmail app passwords often have spaces)
  const cleanedPassword = pass.replace(/\s+/g, '');

  console.log(`🔧 SMTP Config: ${user} via ${host}:${port} (secure: ${secure})`);

  return nodemailer.createTransport({
    host,
    port,
    secure, // true = SMTPS (465), false = STARTTLS (587)
    auth: {
      user,
      pass: cleanedPassword
    },
    connectionTimeout: 30000, // 30s (increased for cloud environments)
    greetingTimeout: 30000,
    socketTimeout: 30000,
    debug: true, // Enable debug output
    logger: true // Log to console
  });
};

const sendWithFallback = async (mailOptions) => {
  // Try SSL port 465 first, then STARTTLS 587 if connection times out/blocked
  let lastError = null;

  // Try port 465 (SSL)
  try {
    console.log('🔌 Attempting SMTP connection on port 465 (SSL)...');
    const primary = buildTransporter(465, true);
    await primary.verify();
    console.log('✓ SMTP connection verified on port 465');
    const result = await primary.sendMail(mailOptions);
    console.log('✓ Email sent successfully via port 465');
    return result;
  } catch (err) {
    lastError = err;
    console.warn(`⚠ Port 465 failed: ${err.code || 'NO_CODE'} - ${err.message}`);
    console.warn(`⚠ Full error:`, JSON.stringify({ code: err.code, command: err.command, response: err.response }, null, 2));
  }

  // Try port 587 (STARTTLS) as fallback
  try {
    console.log('🔄 Retrying with port 587 (STARTTLS)...');
    const fallback = buildTransporter(587, false);
    await fallback.verify();
    console.log('✓ SMTP connection verified on port 587');
    const result = await fallback.sendMail(mailOptions);
    console.log('✓ Email sent successfully via port 587');
    return result;
  } catch (fallbackErr) {
    console.error(`❌ Port 587 also failed: ${fallbackErr.code || 'NO_CODE'} - ${fallbackErr.message}`);
    console.error(`❌ Full error:`, JSON.stringify({ code: fallbackErr.code, command: fallbackErr.command, response: fallbackErr.response }, null, 2));
    // Throw the more descriptive error
    throw fallbackErr.message.length > (lastError?.message?.length || 0) ? fallbackErr : lastError;
  }
};

const sendWithResend = async (mailOptions) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || process.env.EMAIL_USER;
  if (!apiKey || !from) {
    throw new Error('Resend not configured (RESEND_API_KEY and RESEND_FROM or EMAIL_USER required).');
  }

  // Build payload with optional attachments
  const payload = {
    from,
    to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
    subject: mailOptions.subject,
    html: mailOptions.html
  };

  // Add attachments if present (Resend supports base64 encoded attachments)
  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    payload.attachments = mailOptions.attachments.map(att => ({
      filename: att.filename,
      content: att.content instanceof Buffer ? att.content.toString('base64') : att.content,
      content_type: att.contentType
    }));
  }

  console.log(`📧 Sending via Resend API to: ${payload.to.join(', ')}`);

  // Use built-in fetch (Node 18+) to avoid extra dependency
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed: ${response.status} ${body}`);
  }

  const result = await response.json();
  console.log(`✅ Resend email sent successfully: ${result.id}`);
  return result;
};

// Send email using Brevo (Sendinblue) API - Works great in India
const sendWithBrevo = async (mailOptions) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER;
  const senderName = process.env.BREVO_SENDER_NAME || 'Slidexpress Workflow';

  if (!apiKey) {
    throw new Error('Brevo not configured (BREVO_API_KEY required).');
  }

  // Build Brevo payload
  const payload = {
    sender: {
      name: senderName,
      email: senderEmail
    },
    to: [{
      email: mailOptions.to,
      name: mailOptions.to.split('@')[0] // Use email prefix as name
    }],
    subject: mailOptions.subject,
    htmlContent: mailOptions.html
  };

  // Add attachments if present (Brevo supports base64 encoded attachments)
  if (mailOptions.attachments && mailOptions.attachments.length > 0) {
    payload.attachment = mailOptions.attachments.map(att => ({
      name: att.filename,
      content: att.content instanceof Buffer ? att.content.toString('base64') : att.content
    }));
  }

  console.log(`📧 Sending via Brevo API to: ${mailOptions.to}`);

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Brevo failed: ${response.status} ${body}`);
  }

  const result = await response.json();
  console.log(`✅ Brevo email sent successfully: MessageId ${result.messageId}`);
  return result;
};

// Send OTP email
exports.sendOTPEmail = async (email, otp, purpose) => {
  const subject = purpose === 'first_login'
    ? 'Welcome! Reset Your Password - Slidexpress Workflow'
    : 'Password Reset OTP - Slidexpress Workflow';

  const message = purpose === 'first_login'
    ? `<h2>Welcome to Slidexpress Workflow!</h2>
       <p>This is your first login. Please use the following OTP to reset your password:</p>
       <h1 style="color: #4CAF50;">${otp}</h1>
       <p>This OTP will expire in 10 minutes.</p>
       <p>After resetting your password, please login again with your new credentials.</p>`
    : `<h2>Password Reset Request</h2>
       <p>You have requested to reset your password. Please use the following OTP:</p>
       <h1 style="color: #4CAF50;">${otp}</h1>
       <p>This OTP will expire in 10 minutes.</p>
       <p>If you didn't request this, please ignore this email.</p>`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: subject,
    html: message
  };

  try {
    // Use Gmail SMTP directly
    await sendWithFallback(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
};

// Send assignment email with attachments
exports.sendAssignmentEmail = async (recipientEmail, ticketData, attachments = [], originalEmail = null) => {
  const { jobId, clientName, consultantName, teamLead, deadline, timezone } = ticketData;

  const subject = `New Task is Assigned - Job ID: ${jobId}`;

  // Build original client email section - FORWARD COMPLETE EMAIL AS-IS
  let clientEmailSection = '';
  if (originalEmail) {
    console.log(`\n🎨 ====== FORWARDING COMPLETE CLIENT EMAIL ======`);
    console.log(`📧 Original Email Object:`, {
      hasBody: !!originalEmail.body,
      bodyType: typeof originalEmail.body,
      hasHtml: !!(originalEmail.body?.html),
      hasText: !!(originalEmail.body?.text),
      htmlLength: originalEmail.body?.html?.length || 0,
      textLength: originalEmail.body?.text?.length || 0
    });

    const originalDate = originalEmail.date ? new Date(originalEmail.date).toLocaleString() : 'N/A';
    const originalFrom = originalEmail.from ?
      (originalEmail.from.name ? `${originalEmail.from.name} &lt;${originalEmail.from.address}&gt;` : originalEmail.from.address) :
      'N/A';
    const originalTo = originalEmail.to ?
      originalEmail.to.map(t => t.name ? `${t.name} &lt;${t.address}&gt;` : t.address).join(', ') :
      'N/A';
    const originalCc = originalEmail.cc && originalEmail.cc.length > 0 ?
      originalEmail.cc.map(c => c.name ? `${c.name} &lt;${c.address}&gt;` : c.address).join(', ') :
      null;
    const originalSubject = originalEmail.subject || '(No Subject)';

    // Get the complete email body exactly as received
    let completeEmailBody = '';
    if (originalEmail.body?.html && originalEmail.body.html.trim() !== '') {
      completeEmailBody = originalEmail.body.html;
      console.log(`✓ Using complete HTML body (${completeEmailBody.length} chars)`);
    } else if (originalEmail.body?.text && originalEmail.body.text.trim() !== '') {
      // Convert plain text to HTML preserving line breaks
      const textWithBreaks = originalEmail.body.text.replace(/\n/g, '<br>');
      completeEmailBody = textWithBreaks;
      console.log(`✓ Using complete text body converted to HTML (${originalEmail.body.text.length} chars)`);
    } else {
      completeEmailBody = '<p style="color: #6b7280; font-style: italic;">Email content is being synchronized. Please try again in a moment.</p>';
      console.log(`⚠️ No body content available`);
    }

    console.log(`====== COMPLETE CLIENT EMAIL READY ======\n`);

    // Format as forwarded email - simplified lightweight version
    clientEmailSection = `
      <div style="margin: 30px 0; padding: 15px 0; border-top: 1px solid #ddd;">
        <p style="font-weight: bold; margin: 10px 0;">---------- Forwarded message ---------</p>
        <p style="margin: 5px 0;"><b>From:</b> ${originalFrom}</p>
        <p style="margin: 5px 0;"><b>Date:</b> ${originalDate}</p>
        <p style="margin: 5px 0;"><b>Subject:</b> ${originalSubject}</p>
        <p style="margin: 5px 0;"><b>To:</b> ${originalTo}</p>
        ${originalCc ? `<p style="margin: 5px 0;"><b>Cc:</b> ${originalCc}</p>` : ''}
        <div style="margin: 15px 0; padding: 10px; border-left: 3px solid #2563eb;">
          ${completeEmailBody}
        </div>
      </div>
    `;
  }

  const message = `
    <div style="font-family: Arial, sans-serif;">
      <h2>New Task Assigned</h2>
      <p>Hello,</p>
      <p>You have been assigned a new task:</p>

      <div style="margin: 15px 0; padding: 10px; background: #f5f5f5;">
        <p style="margin: 5px 0;"><b>Job ID:</b> ${jobId || 'N/A'}</p>
        <p style="margin: 5px 0;"><b>Client:</b> ${clientName || 'N/A'}</p>
        <p style="margin: 5px 0;"><b>Consultant:</b> ${consultantName || 'N/A'}</p>
        <p style="margin: 5px 0;"><b>Team Lead:</b> ${teamLead || 'N/A'}</p>
        ${deadline ? `<p style="margin: 5px 0;"><b>Deadline:</b> <span style="color: #d00;">${new Date(deadline).toLocaleString()}</span></p>` : ''}
        ${timezone ? `<p style="margin: 5px 0;"><b>Timezone:</b> ${timezone}</p>` : ''}
      </div>

      ${attachments && attachments.length > 0 ? `
      <p style="margin: 15px 0;"><b>Attachments:</b> ${attachments.length} file(s) attached</p>
      ` : ''}

      ${clientEmailSection}

      <p style="margin-top: 20px;">Please review and start working on the task.</p>

      <hr style="margin: 20px 0;" />

      <p style="color: #666; font-size: 11px;">
        Automated email from Slidexpress Workflow System. Do not reply.
      </p>
    </div>
  `;

  // Filter out attachments with missing content to prevent nodemailer errors
  const validAttachments = attachments.filter(att => {
    if (!att.content) {
      console.log(`⚠️ Skipping attachment "${att.filename}" - no content available`);
      return false;
    }
    return true;
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: subject,
    html: message,
    attachments: validAttachments.map(att => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType
    }))
  };

  try {
    console.log(`\n📧 ====== SENDING ASSIGNMENT EMAIL ======`);
    console.log(`📧 To: ${recipientEmail}`);
    console.log(`📋 Job ID: ${jobId}`);
    console.log(`👤 Client: ${clientName}`);
    console.log(`📎 Attachments: ${validAttachments.length} valid of ${attachments?.length || 0} total`);

    if (!recipientEmail) {
      throw new Error('Recipient email is required');
    }

    // Use Gmail SMTP directly
    console.log('📨 Sending email via Gmail SMTP...');
    await sendWithFallback(mailOptions);
    console.log(`✅ Assignment email sent successfully to: ${recipientEmail}`);
    console.log(`====== EMAIL SENT SUCCESSFULLY ======\n`);
    return { success: true };
  } catch (error) {
    console.error(`\n❌ ====== EMAIL SENDING FAILED ======`);
    console.error(`❌ To: ${recipientEmail}`);
    console.error(`❌ Job ID: ${jobId}`);
    console.error(`❌ Error: ${error.message}`);
    console.error(`❌ Error Stack:`, error.stack);
    console.error(`====== EMAIL FAILED ======\n`);
    return { success: false, error: error.message };
  }
};
