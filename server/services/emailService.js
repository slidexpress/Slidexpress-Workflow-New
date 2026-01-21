const Imap = require('imap');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');

/* ───────────────────────── IMAP CONNECTION ───────────────────────── */
const createImapConnection = (email, password) => {
  const cleanedPassword = password.replace(/\s+/g, '');

  return new Imap({
    user: email,
    password: cleanedPassword,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    connTimeout: 60000,   // 60 seconds
    authTimeout: 60000,   // 60 seconds
    socketTimeout: 60000, // 60 seconds
    keepalive: { interval: 10000, idleInterval: 300000 }
  });
};

/* ───────────────────────── FETCH WITH RETRY ───────────────────────── */
const fetchWithRetry = async (fetchFn, maxRetries = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📧 IMAP attempt ${attempt}/${maxRetries}...`);
      return await fetchFn();
    } catch (err) {
      lastError = err;
      console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds before retry
      }
    }
  }
  throw lastError;
};

/* ───────────────────────── STARRED EMAIL FETCH ───────────────────────── */
const fetchStarredEmails = (email, password, workspaceId, userId) =>
  fetchWithRetry(() => new Promise((resolve, reject) => {
    const imap = createImapConnection(email, password);
    const emails = [];
    let isResolved = false;

    // 90 second overall timeout
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try { imap.end(); } catch (e) {}
        reject(new Error('IMAP connection timeout after 90 seconds'));
      }
    }, 90000);

    const cleanup = () => {
      clearTimeout(timeout);
      try { imap.end(); } catch (e) {}
    };

    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - 1);
    const imapSince = sinceDate.toISOString().split('T')[0];

    imap.once('ready', () => {
      console.log('✓ IMAP connected');
      imap.openBox('INBOX', false, err => {
        if (err) {
          cleanup();
          if (!isResolved) {
            isResolved = true;
            return reject(err);
          }
          return;
        }

        console.log('✓ INBOX opened, searching for starred emails...');
        imap.search(['FLAGGED', ['SINCE', imapSince]], (err, results) => {
          if (err) {
            cleanup();
            if (!isResolved) {
              isResolved = true;
              return reject(err);
            }
            return;
          }

          if (!results || !results.length) {
            console.log('✓ No starred emails found');
            cleanup();
            if (!isResolved) {
              isResolved = true;
              resolve([]);
            }
            return;
          }

          console.log(`✓ Found ${results.length} starred emails`);
          const fetch = imap.fetch(results, { bodies: '', struct: true });

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
                  console.error('Parse error:', err.message);
                  return;
                }

                const h = parsed.headers;
                emailData.messageId = h.get('message-id');
                emailData.subject = parsed.subject || '(No Subject)';
                emailData.date = parsed.date || new Date();

                const from = parsed.from?.value?.[0];
                emailData.from = from
                  ? { name: from.name || '', address: from.address || '' }
                  : { name: '', address: '' };

                emailData.references = parsed.references || [];
                emailData.threadId = parsed.inReplyTo || emailData.references[0] || emailData.messageId;
                emailData.body = { html: parsed.html || '', text: parsed.text || '' };
                emailData.attachments = (parsed.attachments || []).map(a => ({
                  filename: a.filename,
                  contentType: a.contentType,
                  content: a.content
                }));
                emailData.hasAttachments = emailData.attachments.length > 0;
              });
            });

            msg.once('attributes', attrs => {
              emailData.uid = attrs.uid;
            });

            msg.once('end', () => {
              if (emailData.messageId) {
                emails.push(emailData);
              }
            });
          });

          fetch.once('end', () => {
            console.log(`✓ Fetched ${emails.length} emails`);
            cleanup();
            if (!isResolved) {
              isResolved = true;
              resolve(emails);
            }
          });

          fetch.once('error', err => {
            cleanup();
            if (!isResolved) {
              isResolved = true;
              reject(err);
            }
          });
        });
      });
    });

    imap.once('error', err => {
      cleanup();
      if (!isResolved) {
        isResolved = true;
        reject(new Error(`IMAP error: ${err.message}`));
      }
    });

    imap.once('close', () => {
      if (!isResolved) {
        isResolved = true;
        resolve(emails);
      }
    });

    try {
      console.log('📧 Connecting to Gmail IMAP...');
      imap.connect();
    } catch (err) {
      cleanup();
      if (!isResolved) {
        isResolved = true;
        reject(err);
      }
    }
  }));

/* ───────────────────────── FETCH FULL EMAIL BODY ───────────────────────── */
const fetchFullEmailByUid = (email, password, uid) =>
  fetchWithRetry(() => new Promise((resolve, reject) => {
    const imap = createImapConnection(email, password);
    let parsed = null;
    let isResolved = false;

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try { imap.end(); } catch (e) {}
        reject(new Error('Email fetch timeout'));
      }
    }, 60000);

    const cleanup = () => {
      clearTimeout(timeout);
      try { imap.end(); } catch (e) {}
    };

    imap.once('ready', () => {
      imap.openBox('INBOX', false, err => {
        if (err) {
          cleanup();
          if (!isResolved) {
            isResolved = true;
            reject(err);
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
                  reject(err);
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
            parsed ? resolve(parsed) : reject(new Error('Email not found'));
          }
        });

        fetch.once('error', err => {
          cleanup();
          if (!isResolved) {
            isResolved = true;
            reject(err);
          }
        });
      });
    });

    imap.once('error', err => {
      cleanup();
      if (!isResolved) {
        isResolved = true;
        reject(err);
      }
    });

    try {
      imap.connect();
    } catch (err) {
      cleanup();
      if (!isResolved) {
        isResolved = true;
        reject(err);
      }
    }
  }), 2); // Only 2 retries for single email fetch

/* ───────────────────────── SAVE TO DATABASE ───────────────────────── */
const saveEmailsToDatabase = async emails => {
  if (!emails.length) return [];

  const messageIds = emails.map(e => e.messageId);
  const existingEmailsWithJobIds = await Email.find({
    messageId: { $in: messageIds },
    jobId: { $exists: true, $ne: null }
  }).select('messageId jobId').lean();

  const messageIdsWithJobIds = new Set(existingEmailsWithJobIds.map(e => e.messageId));

  const operations = emails.map(e => {
    const { jobId, ...emailDataWithoutJobId } = e;
    const fullEmailData = {
      ...emailDataWithoutJobId,
      body: e.body,
      attachments: e.attachments,
      hasAttachments: e.hasAttachments
    };

    if (messageIdsWithJobIds.has(e.messageId)) {
      return {
        updateOne: {
          filter: { messageId: e.messageId, workspace: e.workspace },
          update: { $set: fullEmailData }
        }
      };
    } else {
      return {
        updateOne: {
          filter: { messageId: e.messageId, workspace: e.workspace },
          update: {
            $set: fullEmailData,
            $setOnInsert: { createdAt: new Date(), jobId: null }
          },
          upsert: true
        }
      };
    }
  });

  await Email.bulkWrite(operations, { ordered: false });
  return emails;
};

/* ───────────────────────── OTHER FUNCTIONS ───────────────────────── */
const fetchEmailBodiesInParallel = async (email, password, list, concurrency = 5) => {
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

const updateEmailBodies = async results => {
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

const getStoredEmails = (workspace, limit = 50, skip = 0) =>
  Email.find({ workspace, isStarred: true })
    .sort({ date: -1 })
    .limit(limit)
    .skip(skip)
    .select('_id messageId subject from date hasAttachments isStarred uid threadId')
    .lean();

const getStoredEmailsCount = (workspace) =>
  Email.countDocuments({ workspace, isStarred: true });

const getEmailById = id => Email.findById(id).lean();
const deleteEmail = id => Email.findByIdAndDelete(id);

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
