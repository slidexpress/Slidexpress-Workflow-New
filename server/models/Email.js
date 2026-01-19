const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  filename: String,
  contentType: String,
  size: Number,
  content: Buffer, // Store file content as buffer
  contentId: String
});

const emailSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  uid: {
    type: Number,
    index: true // IMAP UID for incremental sync
  },
  // Thread tracking fields
  inReplyTo: {
    type: String,
    default: null,
    index: true // For finding parent emails
  },
  references: {
    type: [String], // Array of message IDs in the thread
    default: []
  },
  threadId: {
    type: String,
    default: null,
    index: true // Computed thread identifier
  },
  from: {
    name: String,
    address: {
      type: String,
      required: true
    }
  },
  to: [{
    name: String,
    address: String
  }],
  cc: [{
    name: String,
    address: String
  }],
  subject: {
    type: String,
    default: '(No Subject)'
  },
  body: {
    html: String,
    text: String
  },
  signature: String,
  attachments: [attachmentSchema],
  hasAttachments: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    default: Date.now
  },
  isStarred: {
    type: Boolean,
    default: true
  },
  workspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  fetchedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  jobId: {
    type: String,
    default: null,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ⚡ CRITICAL PERFORMANCE INDEXES
// messageId index is automatically created due to unique: true
emailSchema.index({ workspace: 1, isStarred: 1, date: -1 }); // Compound index for main query
emailSchema.index({ workspace: 1, messageId: 1 }); // For bulk operations
emailSchema.index({ workspace: 1, isStarred: 1, uid: 1 }); // For background body fetch query
emailSchema.index({ workspace: 1, uid: 1 }); // For IMAP UID lookups
emailSchema.index({ workspace: 1, 'body.html': 1 }); // For finding emails without bodies

module.exports = mongoose.model('Email', emailSchema);
