const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  consultantName: { type: String, required: true },
  clientName: { type: String, required: true },
  clientEmail: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: false },
  status: { type: String, default: "not_assigned" }, // not_assigned, assigned, in_process, rf_qc, qcd, file_received, sent
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedInfo: {
    empName: { type: String, default: null },
    teamLead: { type: String, default: null },
    // Support for multiple team members and leads (ClickUp-style)
    teamMembers: { type: [String], default: [] },
    teamLeads: { type: [String], default: [] },
    // Owner designation (only one per ticket)
    owner: { type: String, default: null }
  },
  meta: {
    // Support both string and array for backward compatibility
    toCheck: { type: mongoose.Schema.Types.Mixed, default: null }, // Can be string or array
    clientType: { type: mongoose.Schema.Types.Mixed, default: null }, // Can be string or array
    teamEst: { type: String, default: null },
    deadline: { type: String, default: null },
    timezone: { type: String, default: null },
    comments: { type: String, default: null },
    fileOutput: { type: mongoose.Schema.Types.Mixed, default: null }, // Can be string or array - PowerPoint, Word, Excel, PDF, Google Slides, Google Docs, Google Sheets
    // New fields for tracking slides
    new: { type: String, default: null },
    edits: { type: String, default: null },
    // Additional tracking fields
    remainingSeconds: { type: Number, default: null },
    originalEstSeconds: { type: Number, default: null },
    startedAt: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    sharePointLink: { type: String, default: null }
  },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  assignedAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  attachments: { type: Array, default: [] },
  hasAttachments: { type: Boolean, default: false },
  sourceEmailId: { type: mongoose.Schema.Types.ObjectId, ref: 'Email', default: null },
  // Store multiple emails associated with this ticket
  emails: { type: Array, default: [] },
  // Gmail message ID for tracking starred emails and preventing duplicates
  messageId: { type: String, default: null },
  // Gmail UID for faster email fetching
  emailUid: { type: Number, default: null },
  // Thread tracking - prevents creating multiple tickets for email threads
  threadId: { type: String, default: null, index: true },
  // Store email metadata
  emailFrom: {
    name: { type: String, default: null },
    address: { type: String, default: null }
  },
  emailDate: { type: Date, default: null },
  // ⚡ INSTANT ACCESS: Store email body directly in ticket for zero-latency display
  emailBodyHtml: { type: String, default: null },
  emailBodyText: { type: String, default: null },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
  // Merge tracking
  mergeCount: { type: Number, default: 0 },
  mergeHistory: {
    type: [{
      sourceJobId: String,
      sourceTicketId: mongoose.Schema.Types.ObjectId,
      mergedAt: Date,
      emailCount: Number
    }],
    default: []
  }
});

// ⚡ CRITICAL PERFORMANCE INDEXES
ticketSchema.index({ workspace: 1, status: 1 }); // Fast filtering by workspace + status
ticketSchema.index({ workspace: 1, createdAt: -1 }); // Fast sorting by creation date
ticketSchema.index({ workspace: 1, assignedTo: 1 }); // Fast filtering by assignee
ticketSchema.index({ messageId: 1 }); // Fast email lookup
ticketSchema.index({ status: 1, createdAt: -1 }); // Fast status filtering with sort
ticketSchema.index({ workspace: 1, messageId: 1 }); // Fast ticket lookup during sync
ticketSchema.index({ workspace: 1, threadId: 1 }); // Fast thread-based duplicate prevention
ticketSchema.index({ 'assignedInfo.teamMembers': 1, createdAt: -1 }); // Fast team member tasks lookup
ticketSchema.index({ 'assignedInfo.empName': 1, createdAt: -1 }); // Fast employee tasks lookup

module.exports = mongoose.model("Ticket", ticketSchema);
