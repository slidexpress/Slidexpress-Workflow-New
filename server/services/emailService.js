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
    connTimeout: 30000,
    authTimeout: 30000,
    socketTimeout: 30000
  });
};

/* ───────────────────────── FETCH STARRED EMAILS WITH BODY ───────────────────────── */
const fetchStarredEmails = (email, password, workspaceId, userId) =>
  new Promise((resolve, reject) => {
    const imap = createImapConnection(email, password);
    const emails = [];
    let isResolved = false;
    let pendingParsers = 0;

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try { imap.end(); } catch (e) {}
        resolve(emails); // Return what we have so far
      }
    }, 60000); // 60 second max

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
          if (!isResolved) { isResolved = true; reject(err); }
          return;
        }

        imap.search(['FLAGGED', ['SINCE', imapSince]], (err, results) => {
          if (err || !results?.length) {
            cleanup();
            if (!isResolved) { isResolved = true; resolve([]); }
            return;
          }

          console.log(`📧 Found ${results.length} starred emails, fetching with body...`);

          // Fetch full email with body for forwarding
          const fetch = imap.fetch(results, { bodies: '', struct: true });

          fetch.on('message', msg => {
            const emailData = {
              workspace: workspaceId,
              fetchedBy: userId,
              isStarred: true,
              attachments: []
            };

            pendingParsers++;

            msg.on('body', stream => {
              simpleParser(stream, (err, parsed) => {
                pendingParsers--;

                if (err) {
                  console.error('Parse error:', err.message);
                  return;
                }

                // Extract all data needed for forwarding
                emailData.messageId = parsed.headers.get('message-id')?.replace(/[<>]/g, '');
                emailData.subject = parsed.subject || '(No Subject)';
                emailData.date = parsed.date || new Date();

                const from = parsed.from?.value?.[0];
                emailData.from = from
                  ? { name: from.name || '', address: from.address || '' }
                  : { name: '', address: '' };

                // Get To and CC for forwarding
                emailData.to = parsed.to?.value || [];
                emailData.cc = parsed.cc?.value || [];

                emailData.references = parsed.references || [];
                emailData.threadId = parsed.inReplyTo || emailData.references[0] || emailData.messageId;

                // IMPORTANT: Get body for forwarding
                emailData.body = {
                  html: parsed.html || '',
                  text: parsed.text || ''
                };

                // Get attachment metadata (skip content to save space)
                emailData.attachments = (parsed.attachments || []).map(a => ({
                  filename: a.filename,
                  contentType: a.contentType,
                  size: a.size,
                  contentId: a.contentId
                  // Skip content to make sync faster
                }));
                emailData.hasAttachments = emailData.attachments.length > 0;

                if (emailData.messageId) {
                  emails.push(emailData);
                }
              });
            });

            msg.once('attributes', attrs => {
              emailData.uid = attrs.uid;
            });
          });

          fetch.once('end', () => {
            // Wait for all parsers to complete
            const checkComplete = () => {
              if (pendingParsers === 0) {
                console.log(`✅ Synced ${emails.length} emails with body content`);
                cleanup();
                if (!isResolved) { isResolved = true; resolve(emails); }
              } else {
                setTimeout(checkComplete, 100);
              }
            };
            setTimeout(checkComplete, 500);
          });

          fetch.once('error', err => {
            cleanup();
            if (!isResolved) { isResolved = true; reject(err); }
          });
        });
      });
    });

    imap.once('error', err => {
      cleanup();
      if (!isResolved) { isResolved = true; reject(new Error(`IMAP: ${err.message}`)); }
    });

    imap.connect();
  });

/* ───────────────────────── FETCH FULL EMAIL BY UID ───────────────────────── */
const fetchFullEmailByUid = (email, password, uid) =>
  new Promise((resolve, reject) => {
    const imap = createImapConnection(email, password);
    let parsed = null;
    let isResolved = false;

    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try { imap.end(); } catch (e) {}
        reject(new Error('Fetch timeout'));
      }
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
      try { imap.end(); } catch (e) {}
    };

    imap.once('ready', () => {
      imap.openBox('INBOX', false, err => {
        if (err) {
          cleanup();
          if (!isResolved) { isResolved = true; reject(err); }
          return;
        }

        const fetch = imap.fetch(uid, { bodies: '' });

        fetch.on('message', msg =>
          msg.on('body', stream =>
            simpleParser(stream, (err, p) => {
              if (err) {
                cleanup();
                if (!isResolved) { isResolved = true; reject(err); }
                return;
              }
              parsed = {
                body: { html: p.html || '', text: p.text || '' },
                from: p.from?.value?.[0] || { name: '', address: '' },
                to: p.to?.value || [],
                cc: p.cc?.value || [],
                subject: p.subject,
                date: p.date,
                attachments: (p.attachments || []).map(a => ({
                  filename: a.filename,
                  contentType: a.contentType,
                  content: a.content,
                  size: a.size
                }))
              };
            })
          )
        );

        fetch.once('end', () => {
          cleanup();
          if (!isResolved) {
            isResolved = true;
            parsed ? resolve(parsed) : reject(new Error('Not found'));
          }
        });

        fetch.once('error', err => {
          cleanup();
          if (!isResolved) { isResolved = true; reject(err); }
        });
      });
    });

    imap.once('error', err => {
      cleanup();
      if (!isResolved) { isResolved = true; reject(err); }
    });

    imap.connect();
  });

/* ───────────────────────── SAVE TO DATABASE ───────────────────────── */
const saveEmailsToDatabase = async emails => {
  if (!emails.length) return [];

  const messageIds = emails.map(e => e.messageId).filter(Boolean);
  const existingWithJobIds = await Email.find({
    messageId: { $in: messageIds },
    jobId: { $exists: true, $ne: null }
  }).select('messageId').lean();

  const hasJobId = new Set(existingWithJobIds.map(e => e.messageId));

  const operations = emails.filter(e => e.messageId).map(e => {
    const { jobId, ...data } = e;

    if (hasJobId.has(e.messageId)) {
      return {
        updateOne: {
          filter: { messageId: e.messageId, workspace: e.workspace },
          update: { $set: data }
        }
      };
    } else {
      return {
        updateOne: {
          filter: { messageId: e.messageId, workspace: e.workspace },
          update: { $set: data, $setOnInsert: { createdAt: new Date(), jobId: null } },
          upsert: true
        }
      };
    }
  });

  if (operations.length > 0) {
    await Email.bulkWrite(operations, { ordered: false });
  }
  return emails;
};

/* ───────────────────────── DB FUNCTIONS ───────────────────────── */
const getStoredEmails = (workspace, limit = 50, skip = 0) =>
  Email.find({ workspace, isStarred: true })
    .sort({ date: -1 })
    .limit(limit)
    .skip(skip)
    .select('_id messageId subject from to cc date hasAttachments isStarred uid threadId jobId body')
    .lean();

const getStoredEmailsCount = (workspace) =>
  Email.countDocuments({ workspace, isStarred: true });

const getEmailById = id => Email.findById(id).lean();
const deleteEmail = id => Email.findByIdAndDelete(id);

const fetchEmailBodiesInParallel = async () => ({ updated: 0 });
const updateEmailBodies = async () => ({ updated: 0 });

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
