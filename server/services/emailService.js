const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');

/* ───────────────────────── IMAP CONNECTION ───────────────────────── */
const createImapConnection = (email, password) => {
  // Remove spaces from password (Gmail app passwords often have spaces like "xxxx xxxx xxxx xxxx")
  const cleanedPassword = password.replace(/\s+/g, '');

  return new Imap({
    user: email,
    password: cleanedPassword,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 15000,   // 15 seconds for connection (increased for reliability)
    authTimeout: 15000,   // 15 seconds for authentication (increased for reliability)
    socketTimeout: 15000, // 15 seconds for socket operations (increased for reliability)
    keepalive: { interval: 10000, idleInterval: 300000 }
  });
};

/* ───────────────────────── STARRED EMAIL FETCH ───────────────────────── */
const fetchStarredEmails = (email, password, workspaceId, userId) =>
  new Promise((resolve, reject) => {
    const imap = createImapConnection(email, password);
    const emails = [];

    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - 1); // last 1 month
    const imapSince = sinceDate.toISOString().split('T')[0]; // YYYY-MM-DD

    imap.once('ready', () => {
      imap.openBox('INBOX', false, err => {
        if (err) return reject(err);

        imap.search(['FLAGGED', ['SINCE', imapSince]], (err, results) => {
          if (err || !results.length) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results, {
            bodies: '',
            struct: true
          });

          fetch.on('message', msg => {
            const emailData = {
              workspace: workspaceId,
              fetchedBy: userId,
              isStarred: true,
              attachments: []
            };

            msg.on('body', stream => {
              simpleParser(stream, (err, parsed) => {
                if (err) {
                  console.error('Error parsing email stream:', err);
                  return;
                }

                // Extract headers
                const h = parsed.headers;
                emailData.messageId = h.get('message-id');
                emailData.subject = parsed.subject || '(No Subject)';
                emailData.date = parsed.date || new Date();

                const from = parsed.from?.value?.[0];
                if (from) {
                  emailData.from = { name: from.name || '', address: from.address || '' };
                } else {
                  emailData.from = { name: '', address: '' };
                }

                emailData.references = parsed.references || [];
                emailData.threadId = parsed.inReplyTo || emailData.references[0] || emailData.messageId;

                // Extract body and attachments
                emailData.body = { html: parsed.html || '', text: parsed.text || '' };
                emailData.attachments = (parsed.attachments || []).map(a => ({
                  filename: a.filename,
                  contentType: a.contentType,
                  content: a.content // This will be a Buffer
                }));
                emailData.hasAttachments = emailData.attachments.length > 0;
              });
            });

            msg.once('attributes', attrs => {
              emailData.uid = attrs.uid;
            });

            msg.once('end', () => emails.push(emailData));
          });

          fetch.once('end', () => {
            imap.end();
            resolve(emails);
          });

          fetch.once('error', reject);
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });

/* ───────────────────────── ATTACHMENTS DETECTION ───────────────────────── */
const checkAttachments = (struct) => {
  if (!struct) return false;
  if (Array.isArray(struct)) {
    return struct.some(item => {
      if (item.disposition && item.disposition.type.toUpperCase() === 'ATTACHMENT') return true;
      if (item.parts) return checkAttachments(item.parts);
      return false;
    });
  }
  return false;
};

/* ───────────────────────── FETCH FULL EMAIL BODY ───────────────────────── */
const fetchFullEmailByUid = (email, password, uid) =>
  new Promise((resolve, reject) => {
    const imap = createImapConnection(email, password);
    let parsed = null;
    let connectionTimeout;
    let isResolved = false;

    // Add 15 second timeout (increased for reliability)
    connectionTimeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        imap.end();
        reject(new Error('Email fetch timeout - IMAP connection took too long'));
      }
    }, 15000);

    const cleanup = () => {
      clearTimeout(connectionTimeout);
      if (imap.state !== 'disconnected') {
        imap.end();
      }
    };

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          cleanup();
          if (!isResolved) {
            isResolved = true;
            return reject(new Error(`Failed to open INBOX: ${err.message}`));
          }
          return;
        }

        const fetch = imap.fetch(uid, { bodies: '' });

        fetch.on('message', msg =>
          msg.on('body', stream =>
            simpleParser(stream, (err, p) => {
              if (err) {
                cleanup();
                if (!isResolved) {
                  isResolved = true;
                  return reject(new Error(`Email parsing failed: ${err.message}`));
                }
                return;
              }
              parsed = {
                body: { html: p.html || '', text: p.text || '' },
                attachments: (p.attachments || []).map(a => ({
                  filename: a.filename,
                  contentType: a.contentType,
                  content: a.content
                }))
              };
            })
          )
        );

        fetch.once('end', () => {
          cleanup();
          if (!isResolved) {
            isResolved = true;
            parsed ? resolve(parsed) : reject(new Error('Email not found or failed to parse'));
          }
        });

        fetch.once('error', (err) => {
          cleanup();
          if (!isResolved) {
            isResolved = true;
            reject(new Error(`Email fetch failed: ${err.message}`));
          }
        });
      });
    });

    imap.once('error', (err) => {
      cleanup();
      if (!isResolved) {
        isResolved = true;
        reject(new Error(`IMAP connection error: ${err.message}`));
      }
    });

    try {
      imap.connect();
    } catch (err) {
      cleanup();
      if (!isResolved) {
        isResolved = true;
        reject(new Error(`Failed to connect to IMAP: ${err.message}`));
      }
    }
  });

/* ───────────────────────── SAVE HEADERS TO DB ───────────────────────── */
const saveEmailsToDatabase = async emails => {
  if (!emails.length) return [];

  // OPTIMIZATION: Batch lookup all existing emails with jobIds in one query
  const messageIds = emails.map(e => e.messageId);
  const existingEmailsWithJobIds = await Email.find({
    messageId: { $in: messageIds },
    jobId: { $exists: true, $ne: null }
  }).select('messageId jobId').lean();

  // Create a Set of messageIds that already have jobIds for fast lookup
  const messageIdsWithJobIds = new Set(existingEmailsWithJobIds.map(e => e.messageId));

  // Build operations based on whether email has existing jobId
  const operations = emails.map(e => {
    // Create a copy of email data without jobId - we don't want to overwrite it if already linked
    // isStarred is also a top-level field that might change, so it's included in updates
    const { jobId, ...emailDataWithoutJobId } = e; // jobId is the only field to potentially preserve

    // The full email data now contains body and attachments from fetchStarredEmails
    const fullEmailData = {
      ...emailDataWithoutJobId, // Includes everything except jobId
      body: e.body,
      attachments: e.attachments,
      hasAttachments: e.hasAttachments
    };

    if (messageIdsWithJobIds.has(e.messageId)) {
      // Email is already linked to a ticket - preserve jobId
      return {
        updateOne: {
          filter: { messageId: e.messageId, workspace: e.workspace }, // Ensure workspace is in filter
          update: {
            $set: fullEmailData // Update all other fields, including body and attachments
          }
        }
      };
    } else {
      // New email or email without jobId - set all fields and initialize jobId
      return {
        updateOne: {
          filter: { messageId: e.messageId, workspace: e.workspace }, // Ensure workspace is in filter
          update: {
            $set: fullEmailData, // Set all fields, including body, attachments, and isStarred
            $setOnInsert: { createdAt: new Date(), jobId: null } // Only set these on insert
          },
          upsert: true
        }
      };
    }
  });

  await Email.bulkWrite(operations, { ordered: false });

  return emails;
};

/* ───────────────────────── FETCH BODIES IN PARALLEL ───────────────────────── */
const fetchEmailBodiesInParallel = async (email, password, list, concurrency = 10) => {
  const results = [];

  for (let i = 0; i < list.length; i += concurrency) {
    const batch = list.slice(i, i + concurrency);

    const batchRes = await Promise.all(
      batch.map(async e => {
        try {
          const data = await fetchFullEmailByUid(email, password, e.uid);
          return { emailId: e._id, success: true, ...data };
        } catch (err) {
          console.error('Failed to fetch body for UID:', e.uid, err.message);
          return { emailId: e._id, success: false };
        }
      })
    );

    results.push(...batchRes);
  }

  return results;
};

/* ───────────────────────── UPDATE EMAIL BODY CACHE ───────────────────────── */
const updateEmailBodies = async results => {
  // Do updates in parallel (more efficient)
  const updatePromises = results.map(r => {
    if (!r.success) return Promise.resolve(null);
    return Email.findByIdAndUpdate(r.emailId, {
      body: r.body,
      attachments: r.attachments,
      hasAttachments: r.attachments.length > 0
    });
  });

  const updated = (await Promise.all(updatePromises)).filter(r => r !== null).length;
  return { updated };
};

/* ───────────────────────── DB READS ───────────────────────── */
const getStoredEmails = (workspace, limit = 50, skip = 0) =>
  Email.find({ workspace, isStarred: true })
    .sort({ date: -1 })
    .limit(limit) // Only load first 50 emails for speed
    .skip(skip) // For pagination
    .select('_id messageId subject from date hasAttachments isStarred uid threadId') // Only essential fields - NO body or attachments
    .lean();

// Count total emails for pagination
const getStoredEmailsCount = (workspace) =>
  Email.countDocuments({ workspace, isStarred: true });

const getEmailById = id => Email.findById(id).lean();
const deleteEmail = id => Email.findByIdAndDelete(id);

/* ───────────────────────── EXPORTS ───────────────────────── */
module.exports = {
  fetchStarredEmails,
  fetchFullEmailByUid,
  saveEmailsToDatabase,
  fetchEmailBodiesInParallel,
  updateEmailBodies,
  getStoredEmails,
  getStoredEmailsCount,
  getEmailById,
  deleteEmail
};
