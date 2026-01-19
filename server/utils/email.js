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
      pass: pass
    },
    connectionTimeout: 10000, // 10s
    greetingTimeout: 10000,
    socketTimeout: 10000,
    debug: true, // Enable debug output
    logger: true // Log to console
  });
};

const sendWithFallback = async (mailOptions) => {
  // Try SSL port 465 first, then STARTTLS 587 if connection times out/blocked
  try {
    console.log('🔌 Attempting SMTP connection on port 465 (SSL)...');
    const primary = buildTransporter(465, true);
    await primary.verify();
    console.log('✓ SMTP connection verified on port 465');
    const result = await primary.sendMail(mailOptions);
    console.log('✓ Email sent successfully via port 465');
    return result;
  } catch (err) {
    console.warn(`⚠ Port 465 failed: ${err.message}`);
    const transient = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKET'];
    if (!transient.includes(err?.code)) {
      console.error('❌ Non-transient error, not retrying:', err.code, err.message);
      throw err;
    }
    console.log('🔄 Retrying with port 587 (STARTTLS)...');
    try {
      const fallback = buildTransporter(587, false);
      await fallback.verify();
      console.log('✓ SMTP connection verified on port 587');
      const result = await fallback.sendMail(mailOptions);
      console.log('✓ Email sent successfully via port 587');
      return result;
    } catch (fallbackErr) {
      console.error('❌ Port 587 also failed:', fallbackErr.message);
      throw fallbackErr;
    }
  }
};

const sendWithResend = async (mailOptions) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || process.env.EMAIL_USER;
  if (!apiKey || !from) {
    throw new Error('Resend not configured (RESEND_API_KEY and RESEND_FROM or EMAIL_USER required).');
  }

  // Use built-in fetch (Node 18+) to avoid extra dependency
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed: ${response.status} ${body}`);
  }
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
    if (process.env.RESEND_API_KEY) {
      await sendWithResend(mailOptions);
    } else {
      await sendWithFallback(mailOptions);
    }
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

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: subject,
    html: message,
    attachments: attachments.map(att => ({
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
    console.log(`📎 Attachments: ${attachments?.length || 0}`);
    if (attachments && attachments.length > 0) {
      console.log(`📎 Attachment Details:`);
      attachments.forEach((att, idx) => {
        console.log(`   ${idx + 1}. ${att.filename} (${att.contentType}) - ${att.content ? 'Has Content' : 'NO CONTENT'}`);
      });
    }
    console.log(`📬 Original Email: ${originalEmail ? 'Yes' : 'No'}`);
    if (originalEmail) {
      console.log(`📬 Original Email Details:`);
      console.log(`   - Subject: ${originalEmail.subject || 'N/A'}`);
      console.log(`   - Has Body: ${originalEmail.body ? 'Yes' : 'No'}`);
      console.log(`   - Body HTML: ${originalEmail.body?.html?.length || 0} chars`);
      console.log(`   - Body Text: ${originalEmail.body?.text?.length || 0} chars`);
    }

    if (!recipientEmail) {
      throw new Error('Recipient email is required');
    }

    // Always use SMTP for assignment emails (better reliability)
    console.log('📨 Sending email via SMTP...');
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
