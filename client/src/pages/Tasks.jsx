import { useEffect, useState, useRef, useMemo } from 'react';
import { Mail, Play, Pause, CheckCircle, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { teamMemberAPI, ticketAPI } from '../utils/api';
import TicketDetailsModal from '../components/TicketDetailsModal';



/* ===================== TASK GROUP CONFIGS ===================== */
const TASK_GROUPS = {
  pending: {
    id: 'pending',
    label: 'Pending',
    bgColor: 'bg-orange-600',
    statuses: ['assigned']
  },
  paused: {
    id: 'paused',
    label: 'Paused',
    bgColor: 'bg-yellow-600',
    statuses: ['paused']
  },
  active: {
    id: 'active',
    label: 'In Progress',
    bgColor: 'bg-purple-600',
    statuses: ['in_process', 'qc_edits']
  },
  readyForQC: {
    id: 'readyForQC',
    label: 'Ready for QC',
    bgColor: 'bg-indigo-600',
    statuses: ['rf_qc']
  },
  qced: {
    id: 'qced',
    label: 'QC\'ed',
    bgColor: 'bg-cyan-600',
    statuses: ['qcd']
  },
  completed: {
    id: 'completed',
    label: 'Completed',
    bgColor: 'bg-green-600',
    statuses: ['file_received', 'sent']
  },
  onHold: {
    id: 'onHold',
    label: 'On Hold',
    bgColor: 'bg-gray-600',
    statuses: ['on_hold']
  },
  tbc: {
    id: 'tbc',
    label: 'TBC',
    bgColor: 'bg-amber-600',
    statuses: ['tbc']
  },
  cancelled: {
    id: 'cancelled',
    label: 'Cancelled',
    bgColor: 'bg-rose-600',
    statuses: ['cancelled']
  }
};

/* ===================== EMAIL MODAL ===================== */
const EmailModal = ({ jobId, taskId, emails, onClose }) => {
  const [selectedEmailIndex, setSelectedEmailIndex] = useState(0);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleDownloadAttachment = async (emailId, attachmentId, filename, email) => {
    try {
      // Check if this email has attachment content stored directly (from task.emails)
      if (email?.attachments?.[attachmentId]?.content) {
        // Download from task's stored email data
        const response = await fetch(`http://localhost:5000/api/tickets/${taskId}/emails/${emailId}/attachments/${attachmentId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Download from Email API (original emails)
        const response = await fetch(`http://localhost:5000/api/emails/${emailId}/attachments/${attachmentId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Failed to download attachment. Please try again.');
    }
  };

  if (emails.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white w-[900px] rounded-lg shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
          <div className="text-center py-8 text-gray-500">
            <div className="text-6xl mb-3">📭</div>
            <p className="text-sm">No emails found for this job</p>
            <p className="text-xs text-gray-400 mt-1">Job ID: {jobId}</p>
          </div>
          <button
            onClick={onClose}
            className="mt-4 mx-auto block px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md text-sm"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const selectedEmail = emails[selectedEmailIndex];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-[95%] max-w-[1200px] h-[90vh] rounded-lg shadow-2xl flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Email List Sidebar */}
        <div className="w-[350px] border-r bg-gray-50 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-white">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-800">Emails for Job</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded">
              {jobId}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {emails.length} email{emails.length > 1 ? 's' : ''}
            </div>
          </div>

          {/* Email List */}
          <div className="flex-1 overflow-y-auto">
            {emails.map((mail, index) => (
              <div
                key={index}
                onClick={() => setSelectedEmailIndex(index)}
                className={`p-3 border-b cursor-pointer transition-all ${
                  selectedEmailIndex === index
                    ? 'bg-blue-100 border-l-4 border-l-blue-600'
                    : 'hover:bg-gray-100 border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {(mail.from || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs text-gray-900 truncate">
                      {mail.from?.split('<')[0].trim() || mail.from || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {mail.subject || '(No Subject)'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-10">
                  {mail.attachments && mail.attachments.length > 0 && (
                    <span className="text-xs text-gray-500" title="Has attachments">📎</span>
                  )}
                  <span className="text-xs text-gray-400">
                    {mail.date ? new Date(mail.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Email Header */}
          <div className="px-6 py-4 border-b">
            <h1 className="text-xl font-normal text-gray-900 mb-4">
              {selectedEmail.subject || '(No Subject)'}
            </h1>

            {/* Sender Info - Gmail Style */}
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                {(selectedEmail.from || 'U').charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1">
                  <div>
                    <span className="font-medium text-sm text-gray-900">
                      {selectedEmail.from?.split('<')[0].trim() || selectedEmail.from || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {selectedEmail.from?.match(/<(.+)>/)?.[1] || selectedEmail.from}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                    {selectedEmail.date ? new Date(selectedEmail.date).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    }) : ''}
                  </span>
                </div>

                <div className="text-xs text-gray-600">
                  {selectedEmail.to && (
                    <div>to {selectedEmail.to}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Email Body - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Attachments */}
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div className="mb-6 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <h3 className="text-sm font-semibold text-blue-900">
                    {selectedEmail.attachments.length} Attachment{selectedEmail.attachments.length > 1 ? 's' : ''}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {selectedEmail.attachments.map((attachment, attIdx) => {
                    const fileExt = attachment.filename?.split('.').pop()?.toLowerCase() || '';
                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(fileExt);
                    const isPdf = fileExt === 'pdf';
                    const isDoc = ['doc', 'docx'].includes(fileExt);
                    const isXls = ['xls', 'xlsx'].includes(fileExt);
                    const isPpt = ['ppt', 'pptx'].includes(fileExt);

                    return (
                      <button
                        key={attIdx}
                        onClick={() => handleDownloadAttachment(selectedEmail._id, attIdx, attachment.filename, selectedEmail)}
                        className="flex items-center gap-3 px-4 py-3 border-2 border-blue-300 bg-white rounded-lg hover:bg-blue-100 hover:border-blue-500 transition-all group shadow-sm"
                        title={`Click to download ${attachment.filename}`}
                      >
                        <div className="w-10 h-10 flex items-center justify-center rounded bg-blue-100 group-hover:bg-blue-200 transition-colors">
                          {isImage ? <span className="text-xl">🖼️</span> :
                           isPdf ? <span className="text-xl">📄</span> :
                           isDoc ? <span className="text-xl">📝</span> :
                           isXls ? <span className="text-xl">📊</span> :
                           isPpt ? <span className="text-xl">📊</span> :
                           <span className="text-xl">📎</span>}
                        </div>

                        <div className="text-left">
                          <div className="text-sm font-medium text-gray-900 max-w-[200px] truncate">
                            {attachment.filename}
                          </div>
                          {attachment.size && (
                            <div className="text-xs text-gray-500">
                              {(attachment.size / 1024).toFixed(1)} KB
                            </div>
                          )}
                        </div>

                        <svg className="w-5 h-5 text-blue-600 group-hover:text-blue-800 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Email Body Content */}
            <div className="text-sm leading-relaxed">
              {selectedEmail.bodyHtml && selectedEmail.bodyHtml.trim() !== '' ? (
                <div
                  className="email-content gmail-style"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                />
              ) : selectedEmail.body && selectedEmail.body.trim() !== '' && selectedEmail.body !== 'No content' ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 leading-relaxed">
                  {selectedEmail.body}
                </pre>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm">No content available</p>
                  <p className="text-xs mt-2">This email may not have loaded properly</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ===================== QC FEEDBACK VIEW MODAL ===================== */
const QCFeedbackViewModal = ({ ticket, onClose }) => {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const qcFeedback = ticket?.qcFeedback || {};
  const hasQCFeedback = qcFeedback && Object.keys(qcFeedback).length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="bg-white w-[700px] max-h-[85vh] rounded-lg shadow-xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-gray-300 pb-3 mb-4">
          <h2 className="font-semibold text-xl text-gray-800">
            Job Details & QC Feedback
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Job Information */}
        <div className="mb-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg text-gray-700 mb-3">Job Information</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="font-medium text-gray-600">Job ID:</span>
              <span className="ml-2 text-gray-800 font-semibold">{ticket.jobId || '-'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Client:</span>
              <span className="ml-2 text-gray-800">{ticket.clientName || '-'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Status:</span>
              <span className="ml-2 text-gray-800">{ticket.status || '-'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Consultant:</span>
              <span className="ml-2 text-gray-800">{ticket.meta?.consultant || '-'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-600">Team Lead:</span>
              <span className="ml-2 text-gray-800">{ticket.meta?.teamLead || '-'}</span>
            </div>
          </div>
        </div>

        {/* QC Feedback */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-lg text-gray-700 mb-3">QC Feedback Parameters</h3>

          {hasQCFeedback ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {/* Quality */}
              {qcFeedback.quality && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Quality:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.quality}</span>
                </div>
              )}

              {/* Slide Count */}
              {qcFeedback.slideCount && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Slide Count:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.slideCount}</span>
                </div>
              )}

              {/* Slide with Error */}
              {qcFeedback.slideWithError && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Slide with Error:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.slideWithError}</span>
                </div>
              )}

              {/* Content */}
              {qcFeedback.content && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Content:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.content}</span>
                </div>
              )}

              {/* Instruction Missed */}
              {qcFeedback.instructionMissed && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Instruction Missed:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.instructionMissed}</span>
                </div>
              )}

              {/* Layout */}
              {qcFeedback.layout && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Layout:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.layout}</span>
                </div>
              )}

              {/* Format */}
              {qcFeedback.format && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Format:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.format}</span>
                </div>
              )}

              {/* Format - Table */}
              {qcFeedback.formatTable && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Format - Table:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.formatTable}</span>
                </div>
              )}

              {/* Format - Chart */}
              {qcFeedback.formatChart && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Format - Chart:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.formatChart}</span>
                </div>
              )}

              {/* Global Check */}
              {qcFeedback.globalCheck && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">Global Check:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.globalCheck}</span>
                </div>
              )}

              {/* FTR/AOQ */}
              {qcFeedback.ftrAoq && (
                <div className="bg-white p-3 rounded shadow-sm">
                  <span className="font-medium text-gray-600">FTR/AOQ:</span>
                  <span className="ml-2 text-gray-800 font-semibold">{qcFeedback.ftrAoq}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-lg">No QC feedback available for this job yet.</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ===================== STATUS CONFIGS ===================== */
const STATUS_LABEL = {
  not_assigned: 'Not Assigned',
  assigned: 'Assigned',
  in_process: 'In Progress',
  paused: 'Paused',
  rf_qc: 'Ready for QC',
  qcd: 'QC Done',
  qc_edits: 'QC Edits',
  file_received: 'File Received',
  sent: 'Sent',
  on_hold: 'On Hold',
  tbc: 'TBC',
  cancelled: 'Cancelled'
};

const STATUS_BADGE_BG = {
  not_assigned: 'bg-red-600',
  assigned: 'bg-yellow-600',
  in_process: 'bg-blue-600',
  paused: 'bg-yellow-600',
  rf_qc: 'bg-purple-600',
  qcd: 'bg-green-600',
  qc_edits: 'bg-red-500',
  file_received: 'bg-orange-600',
  sent: 'bg-teal-600',
  on_hold: 'bg-gray-600',
  tbc: 'bg-amber-600',
  cancelled: 'bg-rose-600'
};

const HOURS_OPTIONS = Array.from({ length: 25 }, (_, i) => i); // 0-24
const MINUTES_OPTIONS = ['00', '15', '30', '45'];
const FILE_OUTPUT_OPTIONS = ["PowerPoint", "Word", "Excel", "PDF", "Google Slides", "Google Docs", "Google Sheets"];

/* ===================== MODERN DROPDOWN COMPONENT ===================== */
const ModernDropdown = ({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  searchable = false,
  width = "w-full",
  colorClass = "",
  size = "small" // "small" | "medium"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    const handleScroll = (event) => {
      // Only close if scrolling outside the dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, searchable]);

  // Filter options based on search
  const filteredOptions = searchable
    ? options.filter(opt => {
        const label = typeof opt === 'object' ? opt.label : opt;
        return label.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : options;

  const selectedOption = options.find(opt => {
    const optValue = typeof opt === 'object' ? opt.value : opt;
    return optValue === value;
  });

  const displayValue = selectedOption
    ? (typeof selectedOption === 'object' ? selectedOption.label : selectedOption)
    : placeholder;

  const handleSelect = (option) => {
    const optValue = typeof option === 'object' ? option.value : option;
    onChange(optValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const heightClass = size === "small" ? "h-[20px]" : "h-[24px]";
  const textSize = size === "small" ? "text-[11px]" : "text-[12px]";
  const paddingClass = size === "small" ? "px-1.5 py-0.5" : "px-2 py-1";

  return (
    <div className={`relative ${width}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${width} ${heightClass} ${paddingClass} ${textSize} bg-white border border-transparent rounded hover:border-gray-200 hover:bg-gray-50 transition-all text-left flex items-center justify-between ${colorClass} font-medium focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200`}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown size={12} className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="fixed mt-1 min-w-[150px] bg-white border border-gray-200 rounded-lg z-[9999] overflow-hidden"
             style={{
               top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY,
               left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX,
               width: dropdownRef.current?.offsetWidth || 'auto'
             }}>
          {/* Search Input (if searchable) */}
          {searchable && options.length > 5 && (
            <div className="px-2 py-1.5 border-b border-gray-200 bg-gray-50">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-[200px] overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => {
                const optValue = typeof option === 'object' ? option.value : option;
                const optLabel = typeof option === 'object' ? option.label : option;
                const isDisabled = typeof option === 'object' && option.disabled;
                const isSelected = optValue === value;

                return (
                  <button
                    key={index}
                    onClick={() => !isDisabled && handleSelect(option)}
                    disabled={isDisabled}
                    className={`w-full px-3 py-1.5 text-[11px] text-left transition-colors ${
                      isDisabled
                        ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                        : isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'hover:bg-blue-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{optLabel}</span>
                      {isSelected && (
                        <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-[10px] text-gray-500">
                No options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ===================== MULTI-SELECT DROPDOWN COMPONENT ===================== */
const MultiSelectDropdown = ({
  selectedValues = [],
  onChange,
  options = [],
  placeholder = "Select...",
  width = "w-full",
  size = "small"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (option) => {
    const value = typeof option === 'object' ? option.value : option;
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  const heightClass = size === "small" ? "min-h-[20px]" : "min-h-[24px]";
  const textSize = size === "small" ? "text-[11px]" : "text-[12px]";
  const paddingClass = size === "small" ? "px-1.5 py-0.5" : "px-2 py-1";

  return (
    <div className={`relative ${width}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${width} ${heightClass} ${paddingClass} ${textSize} bg-white border border-transparent rounded hover:border-gray-200 hover:bg-gray-50 transition-all text-left flex items-center justify-between font-medium focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200`}
      >
        <div className="flex flex-wrap gap-1 flex-1 min-h-[18px]">
          {selectedValues.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            selectedValues.map((val, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-semibold"
              >
                {val}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(val);
                  }}
                  className="hover:text-blue-900"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown size={12} className={`ml-1 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="fixed mt-1 min-w-[150px] bg-white border border-gray-200 rounded-lg z-[9999] overflow-hidden shadow-lg"
             style={{
               top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY,
               left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX,
               width: dropdownRef.current?.offsetWidth || 'auto'
             }}>
          {/* Options List */}
          <div className="max-h-[200px] overflow-y-auto">
            {options.length > 0 ? (
              options.map((option, index) => {
                const optValue = typeof option === 'object' ? option.value : option;
                const optLabel = typeof option === 'object' ? option.label : option;
                const isSelected = selectedValues.includes(optValue);

                return (
                  <button
                    key={index}
                    onClick={() => toggleOption(option)}
                    className={`w-full px-3 py-1.5 text-[11px] text-left transition-colors flex items-center gap-2 ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'hover:bg-blue-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 pointer-events-none"
                    />
                    <span>{optLabel}</span>
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-center text-[10px] text-gray-500">
                No options available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ===================== UTILITY FUNCTIONS ===================== */
const parseEstimate = (estStr) => {
  if (!estStr) return { hours: 0, minutes: '00' };
  const hhmm = estStr.match(/(\d+)h\s*(\d+)m/);
  if (hhmm) return { hours: parseInt(hhmm[1]), minutes: hhmm[2].padStart(2, '0') };
  const colon = estStr.match(/(\d+):(\d+)/);
  if (colon) return { hours: parseInt(colon[1]), minutes: colon[2].padStart(2, '0') };
  const hoursOnly = estStr.match(/^(\d+)$/);
  if (hoursOnly) return { hours: parseInt(hoursOnly[1]), minutes: '00' };
  return { hours: 0, minutes: '00' };
};

const formatEstimate = (hours, minutes) => {
  if (hours === 0 && minutes === '00') return '';
  return `${hours}h ${minutes}m`;
};

const formatDateTime = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
};

/* ===================== DEADLINE DISPLAY WITH TODAY/TOMORROW ===================== */
const formatDeadlineDisplay = (datetimeLocal, timezone) => {
  if (!datetimeLocal || !timezone) return "-";

  const utcMatch = timezone.match(/UTC([+-]\d+:?\d*)/);
  if (!utcMatch) return "-";

  const utcOffset = utcMatch[1];
  const datetime = new Date(datetimeLocal);

  const offsetParts = utcOffset.match(/([+-])(\d+):?(\d*)/);
  if (!offsetParts) return "-";

  const sign = offsetParts[1] === '+' ? 1 : -1;
  const offsetHours = parseInt(offsetParts[2]);
  const offsetMinutes = offsetParts[3] ? parseInt(offsetParts[3]) : 0;
  const totalOffsetMinutes = sign * (offsetHours * 60 + offsetMinutes);

  const utcTime = new Date(datetime.getTime() - totalOffsetMinutes * 60000);
  const istTime = new Date(utcTime.getTime() + (5.5 * 60 * 60000));

  // Get today's date in IST (with corrected formula)
  const now = new Date();
  const istNow = new Date(now.getTime() + (5.5 * 60 * 60000) + (now.getTimezoneOffset() * 60000));

  // Set times to midnight for date comparison
  const deadlineDate = new Date(istTime.getFullYear(), istTime.getMonth(), istTime.getDate());
  const todayDate = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());

  // Calculate difference in days
  const diffTime = deadlineDate - todayDate;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Format time
  let hours = istTime.getHours();
  const minutes = istTime.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const timeStr = `${hours}:${minutes} ${ampm}`;

  // Calculate days until next Sunday
  const currentDayOfWeek = istNow.getDay();
  const daysUntilSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;

  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Tomorrow, ${timeStr}`;
  } else if (diffDays > 1 && diffDays <= daysUntilSunday) {
    const dayName = days[istTime.getDay()];
    return `${dayName}, ${timeStr}`;
  } else {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const day = istTime.getDate();
    const month = months[istTime.getMonth()];
    const year = istTime.getFullYear();
    return `${day}-${month}-${year}, ${timeStr}`;
  }
};

/* ===================== TOAST NOTIFICATION ===================== */
const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 10000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in">
      <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <CheckCircle size={20} />
        <span className="font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 hover:bg-green-700 rounded p-1">
          ✕
        </button>
      </div>
    </div>
  );
};

/* ===================== MAIN COMPONENT ===================== */
const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedTaskEmails, setSelectedTaskEmails] = useState([]);
  const [loadingEmailsMap, setLoadingEmailsMap] = useState({});
  const [emailCache, setEmailCache] = useState({}); // Cache emails by jobId for instant loading
  const [toast, setToast] = useState(null);
  const [ganttData, setGanttData] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [showTicketDetails, setShowTicketDetails] = useState(false);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);

  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('tasksCollapsedGroups');
      if (saved) return JSON.parse(saved);
    } catch (error) {
      console.error('Failed to load collapsed groups:', error);
    }
    return {};
  });

  // Update current time every minute for live timeline indicator
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timeInterval);
  }, []);

  // Estimation Modal State
  const [estimationModal, setEstimationModal] = useState({
    show: false,
    taskId: null,
    hours: 0,
    minutes: '00'
  });

  // Active task countdown (remaining seconds, endTime, percent)
  const [activeCountdown, setActiveCountdown] = useState({ remaining: 0, endTime: null, percent: 0 });
  const [notifiedTaskId, setNotifiedTaskId] = useState(null);
  const [showQCViewModal, setShowQCViewModal] = useState(false);
  const [viewTask, setViewTask] = useState(null);

  // Start Task Confirmation Modal
  const [startConfirmModal, setStartConfirmModal] = useState({
    show: false,
    task: null,
    onConfirm: null
  });

  // General Notification Modal (replaces all alerts and confirms)
  const [notificationModal, setNotificationModal] = useState({
    show: false,
    type: 'info', // 'success', 'error', 'warning', 'confirm', 'info'
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'OK',
    cancelText: 'Cancel',
    showCancel: false
  });

  // SharePoint Link Modal State
  const [linkModal, setLinkModal] = useState({
    show: false,
    taskId: null,
    link: '',
    validationError: ''
  });

  // Escape key handlers for modals
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        if (estimationModal.show) {
          setEstimationModal({ show: false, taskId: null, hours: 0, minutes: '00' });
        }
        if (linkModal.show) {
          setLinkModal({ show: false, taskId: null, link: '', validationError: '' });
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [estimationModal.show, linkModal.show]);

  // Save collapsed state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('tasksCollapsedGroups', JSON.stringify(collapsedGroups));
    } catch (error) {
      console.error('Failed to save collapsed groups:', error);
    }
  }, [collapsedGroups]);

  useEffect(() => {
    fetchUserTasks();
  }, [user]);

  // Auto-refresh tasks every 30 seconds
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      if (user) {
        // Fetch tasks without showing loading indicator
        teamMemberAPI.getMyTasks()
          .then(response => {
            setTasks(response.data?.tasks || []);
          })
          .catch(error => {
            console.error('❌ Error auto-refreshing tasks:', error);
          });
      }
    }, 30000); // 30 seconds

    return () => clearInterval(refreshInterval);
  }, [user]);

  // Update countdown for currently active task every second
  useEffect(() => {
    let interval = null;

    const updateCountdown = () => {
      const active = tasks.find(t => t.status === 'in_process');
      if (!active) {
        setActiveCountdown({ remaining: 0, endTime: null, percent: 0 });
        if (notifiedTaskId) setNotifiedTaskId(null);
        return;
      }

      const now = Date.now();

      // Determine remaining and original estimation
      let remainingSec = null;
      let originalSec = null;

      if (active.meta?.remainingSeconds != null) {
        remainingSec = Number(active.meta.remainingSeconds);
      }
      if (active.meta?.originalEstSeconds != null) {
        originalSec = Number(active.meta.originalEstSeconds);
      }

      // If there is no remainingSec but teamEst exists (first start)
      if (remainingSec == null && active.meta?.teamEst) {
        // Use per-person estimation if multiple team members assigned
        const estCalc = calculatePerPersonEstimation(active);
        if (estCalc && estCalc.count > 1) {
          // Use per-person estimation for multiple assignees
          const { hours, minutes } = parseEstimate(estCalc.perPerson || '');
          remainingSec = (Number(hours) * 3600) + (Number(minutes) * 60);
        } else {
          // Use total estimation for single assignee
          const { hours, minutes } = parseEstimate(active.meta.teamEst || '');
          remainingSec = (Number(hours) * 3600) + (Number(minutes) * 60);
        }
        originalSec = originalSec || remainingSec;
      }

      // If still no start time or no remaining, reset
      if (!active.meta?.startedAt || remainingSec == null) {
        setActiveCountdown({ remaining: remainingSec || 0, endTime: null, percent: 0 });
        return;
      }

      const startedAt = new Date(active.meta.startedAt).getTime();
      const endTime = startedAt + remainingSec * 1000;
      const remaining = Math.max(0, Math.round((endTime - now) / 1000));
      const elapsedSinceResume = Math.max(0, Math.round((now - startedAt) / 1000));

      // Percent based on original estimate (if available)
      let percent = 0;
      if (originalSec && originalSec > 0) {
        // total elapsed = (originalSec - currentRemaining) ; but currentRemaining = remaining + elapsedSinceResume? Simpler: compute currentRemainingGlobal = remaining + elapsedSinceResume? Actually remaining here is remaining after resume; elapsedSinceResume is from resume; globalRemaining = remaining (since remaining is what's left after resume). So elapsedGlobal = originalSec - (remaining + (originalSec - remaining - elapsedSinceResume)?) To avoid complexity, compute percent = ((originalSec - (remaining + (active.meta?.pausedAccumulatedSeconds || 0))) / originalSec) but pausedAccumulatedSeconds not tracked. Simpler UX: percent = Math.min(100, Math.round(((originalSec - remaining) / originalSec) * 100));
        percent = Math.min(100, Math.round(((originalSec - remaining) / originalSec) * 100));
      }

      setActiveCountdown({ remaining, endTime, percent });

      // Notify once when estimation completes (remaining <= 0)
      if (remaining <= 0 && active._id && active._id !== notifiedTaskId) {
        showToast(`⏰ Estimation completed for ${active.jobId || 'current task'}`);
        setNotifiedTaskId(active._id);
      }
    };

    updateCountdown();
    interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [tasks]);

  const formatCountdown = (seconds) => {
    if (seconds <= 0) return '00:00:00';
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const fetchUserTasks = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('📥 Fetching tasks for user:', user.name, user.email);
      const response = await teamMemberAPI.getMyTasks();
      console.log('✅ Tasks loaded:', response.data?.tasks?.length || 0);
      setTasks(response.data?.tasks || []);
    } catch (error) {
      console.error('❌ Error fetching user tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const getTasksForGroup = (groupId) => {
    const group = TASK_GROUPS[groupId];
    let filtered = tasks.filter(task => group.statuses.includes(task.status));

    return filtered;
  };

  const getGroupStats = () => {
    return {
      all: tasks.length,
      pending: tasks.filter(t => t.status === 'assigned').length,
      active: tasks.filter(t => t.status === 'in_process').length,
      paused: tasks.filter(t => t.status === 'paused').length,
      readyForQC: tasks.filter(t => t.status === 'rf_qc').length,
      qced: tasks.filter(t => t.status === 'qcd').length,
      completed: tasks.filter(t => ['file_received', 'sent'].includes(t.status)).length
    };
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const task = tasks.find(t => t._id === taskId);

      // Validation: Cannot change to in_process without all required fields
      if (newStatus === 'in_process') {
        if (!canStartTask(task)) {
          const missing = [];
          if (!task.meta?.teamEst || task.meta.teamEst.trim() === '') missing.push('• Estimation');
          if (!task.meta?.fileOutput || ((Array.isArray(task.meta.fileOutput) && task.meta.fileOutput.length === 0) || (typeof task.meta.fileOutput === 'string' && task.meta.fileOutput.trim() === ''))) missing.push('• File Output');
          if (task.meta?.proofread === undefined) missing.push('• Proofread');
          showError(`Cannot start task. Please fill in the following required fields first:\n\n${missing.join('\n')}`, 'Required Fields Missing');
          return;
        }

        // Show custom confirmation modal
        setStartConfirmModal({
          show: true,
          task: task,
          onConfirm: async () => {
            await ticketAPI.updateTicket(taskId, { status: newStatus });
            setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
            showToast(`Status updated to ${STATUS_LABEL[newStatus]}`);
            setStartConfirmModal({ show: false, task: null, onConfirm: null });
          }
        });
        return;
      }

      await ticketAPI.updateTicket(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
      showToast(`Status updated to ${STATUS_LABEL[newStatus]}`);
    } catch (error) {
      console.error('Error updating task status:', error);
      showError('Failed to update task status. Please try again.');
    }
  };

  const handleFileOutputChange = async (task, values) => {
    try {
      // values is now an array
      console.log('📤 Updating file output for task:', task._id, 'with values:', values);

      const payloadMeta = { ...task.meta, fileOutput: values };
      console.log('📦 Payload meta:', payloadMeta);

      const response = await ticketAPI.updateTicket(task._id, { meta: payloadMeta });
      console.log('✅ Update response:', response);

      setTasks(prev => prev.map(t => t._id === task._id ? { ...t, meta: payloadMeta } : t));

      const displayText = values.length === 0
        ? 'none'
        : values.length === 1
        ? values[0]
        : `${values.length} formats`;
      showToast(`File output set to ${displayText}`);
    } catch (error) {
      console.error('❌ Error updating file output:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error message:', error.message);
      showError(`Failed to update file output: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleEstimateChange = async (task, hours, minutes) => {
    // Check if estimate has already been set (one-time only)
    if (task.meta?.teamEst && task.meta.teamEst.trim() !== '') {
      showWarning('Estimation has already been set and cannot be changed.', 'Cannot Change Estimation');
      return;
    }

    // Check if user has permission to set estimation
    if (!canSetEstimation(task)) {
      const owner = task.assignedInfo?.owner || 'the task owner';
      showWarning(
        `This task is assigned to multiple team members.\n\nOnly the task owner (${owner}) can set the estimation for this task.`,
        'Permission Denied'
      );
      return;
    }

    // Open estimation modal instead of directly updating
    setEstimationModal({
      show: true,
      taskId: task._id,
      hours: hours,
      minutes: minutes,
      task: task  // Store task reference for additional checks
    });
  };

  const handleConfirmEstimation = async () => {
    const { taskId, hours, minutes } = estimationModal;
    const task = tasks.find(t => t._id === taskId);

    if (!task) return;

    // Check again if estimation is already set
    if (task.meta?.teamEst && task.meta.teamEst.trim() !== '') {
      showWarning('Estimation has already been set and cannot be changed.', 'Cannot Change Estimation');
      setEstimationModal({ show: false, taskId: null, hours: 0, minutes: '00' });
      return;
    }

    // Double-check permission before saving
    if (!canSetEstimation(task)) {
      const owner = task.assignedInfo?.owner || 'the task owner';
      showWarning(
        `This task is assigned to multiple team members.\n\nOnly the task owner (${owner}) can set the estimation for this task.`,
        'Permission Denied'
      );
      setEstimationModal({ show: false, taskId: null, hours: 0, minutes: '00' });
      return;
    }

    try {
      const formattedEst = formatEstimate(hours, minutes);
      await ticketAPI.updateTicket(taskId, {
        meta: { ...task.meta, teamEst: formattedEst }
      });
      setTasks(prev => prev.map(t =>
        t._id === taskId ? { ...t, meta: { ...t.meta, teamEst: formattedEst } } : t
      ));
      showToast(`Estimation set to ${formattedEst}`);
      setEstimationModal({ show: false, taskId: null, hours: 0, minutes: '00' });
    } catch (error) {
      console.error('Error updating estimate:', error);
      showError('Failed to update estimate. Please try again.');
    }
  };

  const showToast = (message) => {
    setToast(message);
  };

  // Helper functions for notifications
  const showError = (message, title = 'Error') => {
    setNotificationModal({
      show: true,
      type: 'error',
      title,
      message,
      confirmText: 'OK',
      showCancel: false,
      onConfirm: () => setNotificationModal({ ...notificationModal, show: false })
    });
  };

  const showWarning = (message, title = 'Warning') => {
    setNotificationModal({
      show: true,
      type: 'warning',
      title,
      message,
      confirmText: 'OK',
      showCancel: false,
      onConfirm: () => setNotificationModal({ ...notificationModal, show: false })
    });
  };

  const showSuccess = (message, title = 'Success') => {
    setNotificationModal({
      show: true,
      type: 'success',
      title,
      message,
      confirmText: 'OK',
      showCancel: false,
      onConfirm: () => setNotificationModal({ ...notificationModal, show: false })
    });
  };

  const showConfirm = (message, title, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel') => {
    setNotificationModal({
      show: true,
      type: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
      showCancel: true,
      onConfirm: () => {
        setNotificationModal({ ...notificationModal, show: false });
        if (onConfirm) onConfirm();
      }
    });
  };

  // Helper function: Check if task has multiple assignees
  const hasMultipleAssignees = (task) => {
    const teamMembers = task.assignedInfo?.teamMembers || [];
    return teamMembers.length > 1;
  };

  // Helper function: Check if current user is the owner of the task
  const isTaskOwner = (task) => {
    const owner = task.assignedInfo?.owner;
    const empName = task.assignedInfo?.empName;
    const teamMembers = task.assignedInfo?.teamMembers || [];

    console.log('👤 isTaskOwner check:', {
      owner,
      empName,
      teamMembers,
      userName: user.name,
      userEmail: user.email
    });

    // Helper to compare names/emails (case-insensitive, trimmed, partial match)
    const matchesUser = (value) => {
      if (!value) return false;
      const normalizedValue = String(value).trim().toLowerCase();
      const normalizedUserName = String(user.name || '').trim().toLowerCase();
      const normalizedUserEmail = String(user.email || '').trim().toLowerCase();

      // Exact match
      const exactMatch = normalizedValue === normalizedUserName || normalizedValue === normalizedUserEmail;

      // Partial match: check if user's name is contained in the value (as a word)
      const partialMatch = normalizedValue.includes(normalizedUserName) && normalizedUserName.length > 0;

      // Email username match: check if the part before @ matches
      const emailUsername = normalizedUserEmail.split('@')[0];
      const emailMatch = normalizedValue.replace(/\s+/g, '.') === emailUsername ||
                         normalizedValue.replace(/\s+/g, '') === emailUsername.replace(/\./g, '');

      const matches = exactMatch || partialMatch || emailMatch;
      console.log(`  Comparing "${value}" with user "${user.name}": ${matches} (exact: ${exactMatch}, partial: ${partialMatch}, email: ${emailMatch})`);
      return matches;
    };

    // If there's an owner field, check against it
    if (owner) {
      const result = matchesUser(owner);
      console.log(`  ✓ Owner field check: ${result}`);
      return result;
    }

    // Fallback: if no owner but single assignee (empName), that person is the owner
    if (empName && !hasMultipleAssignees(task)) {
      const result = matchesUser(empName);
      console.log(`  ✓ EmpName check (single): ${result}`);
      return result;
    }

    // Fallback for multi-assignee: if no explicit owner, check if user is the first team member (treated as owner)
    if (teamMembers.length > 0 && !owner) {
      const result = matchesUser(teamMembers[0]);
      console.log(`  ✓ First team member check: ${result}`);
      return result;
    }

    console.log('  ❌ No owner match');
    return false;
  };

  const canStartTask = (task) => {
    const hasEstimation = task.meta?.teamEst && task.meta.teamEst.trim() !== '';
    const hasFileOutput = task.meta?.fileOutput && (
      (Array.isArray(task.meta.fileOutput) && task.meta.fileOutput.length > 0) ||
      (typeof task.meta.fileOutput === 'string' && task.meta.fileOutput.trim() !== '')
    );
    const hasProofread = task.meta?.proofread !== undefined;

    return hasEstimation && hasFileOutput && hasProofread;
  };

  // Helper function: Check if user can set estimation
  const canSetEstimation = (task) => {
    console.log('🔍 canSetEstimation called for:', {
      jobId: task.jobId,
      currentUser: user,
      taskOwner: task.assignedInfo?.owner,
      teamMembers: task.assignedInfo?.teamMembers,
      empName: task.assignedInfo?.empName,
      hasMultiple: hasMultipleAssignees(task)
    });

    // If task has multiple assignees, only owner can set estimation
    if (hasMultipleAssignees(task)) {
      const isOwner = isTaskOwner(task);
      console.log('✓ Multi-assignee task - isOwner:', isOwner);
      return isOwner;
    }

    // If single assignee, that person can set estimation
    console.log('✓ Single assignee - returning true');
    return true;
  };

  // Helper function: Calculate per-person estimation when multiple assignees
  const calculatePerPersonEstimation = (task) => {
    if (!task.meta?.teamEst) {
      return null;
    }

    const teamMembers = task.assignedInfo?.teamMembers || [];
    const memberCount = teamMembers.length;

    // If single assignee or no team members, return total estimation
    if (memberCount <= 1) {
      return {
        total: task.meta.teamEst,
        perPerson: task.meta.teamEst,
        count: 1
      };
    }

    // Parse total estimation
    const { hours, minutes } = parseEstimate(task.meta.teamEst);
    const totalMinutes = (hours * 60) + parseInt(minutes);

    // Divide by number of team members
    const perPersonMinutes = totalMinutes / memberCount;
    const perPersonHours = Math.floor(perPersonMinutes / 60);
    const perPersonMins = Math.round(perPersonMinutes % 60);

    return {
      total: task.meta.teamEst,
      perPerson: formatEstimate(perPersonHours, perPersonMins.toString().padStart(2, '0')),
      count: memberCount,
      perPersonDecimal: (perPersonMinutes / 60).toFixed(2) // For display like "2.50h"
    };
  };

  const handleStartTask = async (task) => {
    // Validation: Check if all required fields are set
    if (!canStartTask(task)) {
      const missing = [];
      if (!task.meta?.teamEst || task.meta.teamEst.trim() === '') missing.push('• Estimation');
      if (!task.meta?.fileOutput || ((Array.isArray(task.meta.fileOutput) && task.meta.fileOutput.length === 0) || (typeof task.meta.fileOutput === 'string' && task.meta.fileOutput.trim() === ''))) missing.push('• File Output');
      if (task.meta?.proofread === undefined) missing.push('• Proofread');
      showError(`Cannot start task. Please fill in the following required fields first:\n\n${missing.join('\n')}`, 'Required Fields Missing');
      return;
    }

    // Show custom confirmation modal
    setStartConfirmModal({
      show: true,
      task: task,
      onConfirm: async () => {
        try {
          setStartConfirmModal({ show: false, task: null, onConfirm: null });

          // Find any currently active tasks (in_process status)
          const activeTask = tasks.find(t => t.status === 'in_process' && t._id !== task._id);

          if (activeTask) {
            // Ask user for confirmation using custom modal
            showConfirm(
              `You have another task in progress:\n\n"${activeTask.jobId}" - ${activeTask.clientName}\n\nStarting "${task.jobId}" will automatically pause the above task.`,
              'Task Already In Progress',
              async () => {
                // Auto-pause the currently active task
                console.log(`⏸️ Auto-pausing task ${activeTask.jobId} to start ${task.jobId}`);
                await handlePauseTask(activeTask);
                showToast(`Task "${activeTask.jobId}" paused. Starting "${task.jobId}"...`);

                // Start the new task
                const now = new Date();
                const payloadMeta = { ...task.meta, startedAt: now };
                if (payloadMeta.remainingSeconds == null) {
                  const { hours, minutes } = parseEstimate(payloadMeta.teamEst || '');
                  const estSeconds = (Number(hours) * 3600) + (Number(minutes) * 60);
                  payloadMeta.originalEstSeconds = payloadMeta.originalEstSeconds || estSeconds;
                  payloadMeta.remainingSeconds = estSeconds;
                }
                await ticketAPI.updateTicket(task._id, { status: 'in_process', meta: payloadMeta });
                setTasks(prev => prev.map(t =>
                  t._id === task._id ? { ...t, status: 'in_process', meta: { ...payloadMeta } } : t
                ));
                console.log(`▶️ Started task ${task.jobId}`);
              },
              'Continue',
              'Cancel'
            );
            return; // Exit early, the confirm modal will handle the rest
          } else {
            showToast(`Started task "${task.jobId}"`);
          }

          // Start the new task with timestamp
          // Prepare payload: if this task has remainingSeconds (resuming), keep it; otherwise initialize remaining and original from teamEst
          const now = new Date();
          const payloadMeta = { ...task.meta, startedAt: now };
          if (payloadMeta.remainingSeconds == null) {
            const { hours, minutes } = parseEstimate(payloadMeta.teamEst || '');
            const estSeconds = (Number(hours) * 3600) + (Number(minutes) * 60);
            payloadMeta.originalEstSeconds = payloadMeta.originalEstSeconds || estSeconds;
            payloadMeta.remainingSeconds = estSeconds;
          }

          await ticketAPI.updateTicket(task._id, { status: 'in_process', meta: payloadMeta });
          setTasks(prev => prev.map(t =>
            t._id === task._id ? { ...t, status: 'in_process', meta: { ...payloadMeta } } : t
          ));
          console.log(`▶️ Started task ${task.jobId}`);
        } catch (error) {
          console.error('Error handling task start:', error);
          showError('Failed to start task. Please try again.');
        }
      }
    });
  };

  const handlePauseTask = async (task) => {
    try {
      // Compute remaining seconds based on startedAt and current remaining
      const now = Date.now();
      const meta = task.meta || {};

      // Determine base remaining (either existing remainingSeconds or parsed teamEst)
      let baseRemaining = null;
      if (meta.remainingSeconds != null) baseRemaining = Number(meta.remainingSeconds);
      else if (meta.teamEst) {
        const { hours, minutes } = parseEstimate(meta.teamEst || '');
        baseRemaining = (Number(hours) * 3600) + (Number(minutes) * 60);
      }

      let newRemaining = baseRemaining;
      if (meta.startedAt && baseRemaining != null) {
        const startedAt = new Date(meta.startedAt).getTime();
        const elapsed = Math.round((now - startedAt) / 1000);
        newRemaining = Math.max(0, baseRemaining - elapsed);
      }

      const payloadMeta = {
        ...meta,
        remainingSeconds: newRemaining,
        originalEstSeconds: meta.originalEstSeconds || baseRemaining,
        pausedAt: new Date(),
        startedAt: null
      };

      await ticketAPI.updateTicket(task._id, { status: 'paused', meta: payloadMeta });
      setTasks(prev => prev.map(t => t._id === task._id ? { ...t, status: 'paused', meta: payloadMeta } : t));
      showToast(`Task "${task.jobId}" paused`);
    } catch (error) {
      console.error('Error pausing task:', error);
      showError('Failed to pause task. Please try again.');
    }
  };

  const handleProofreadChange = async (task, newStatus) => {
    try {
      const payloadMeta = { ...task.meta, proofread: newStatus };

      await ticketAPI.updateTicket(task._id, { meta: payloadMeta });
      setTasks(prev => prev.map(t =>
        t._id === task._id ? { ...t, meta: payloadMeta } : t
      ));
      showToast(`Task "${task.jobId}" proofread status set to ${newStatus ? 'Yes' : 'No'}`);
    } catch (error) {
      console.error('Error updating proofread status:', error);
      showError('Failed to update proofread status. Please try again.');
    }
  };

  const handleEndTask = async (task) => {
    await updateTaskStatus(task._id, 'rf_qc');
    showToast(`Task "${task.jobId}" marked as Ready for QC`);
  };

  // SharePoint Link Validation
  const validateSharePointLink = (url) => {
    // Check if URL is valid
    try {
      const urlObj = new URL(url);
      // Check if it's a SharePoint URL
      if (urlObj.hostname.includes('sharepoint') || urlObj.hostname.includes('onedrive') || urlObj.hostname.includes('.microsoft.')) {
        return { valid: true, error: '' };
      } else {
        return { valid: false, error: '❌ Must be a valid SharePoint/OneDrive link' };
      }
    } catch (e) {
      return { valid: false, error: '❌ Invalid URL format' };
    }
  };

  const handleOpenLinkModal = (task) => {
    setLinkModal({
      show: true,
      taskId: task._id,
      link: task.meta?.sharePointLink || '',
      validationError: ''
    });
  };

  const handleConfirmSharePointLink = async () => {
    const { taskId, link } = linkModal;
    const task = tasks.find(t => t._id === taskId);

    if (!task) return;

    if (!link.trim()) {
      setLinkModal(prev => ({ ...prev, validationError: '❌ Link cannot be empty' }));
      return;
    }

    const validation = validateSharePointLink(link);
    if (!validation.valid) {
      setLinkModal(prev => ({ ...prev, validationError: validation.error }));
      return;
    }

    try {
      // Update task with SharePoint link and move to completed
      await ticketAPI.updateTicket(taskId, {
        status: 'file_received',
        meta: { ...task.meta, sharePointLink: link }
      });
      setTasks(prev => prev.map(t =>
        t._id === taskId ? { ...t, status: 'file_received', meta: { ...t.meta, sharePointLink: link } } : t
      ));
      showToast(`✅ SharePoint link validated and task moved to Completed`);
      setLinkModal({ show: false, taskId: null, link: '', validationError: '' });
    } catch (error) {
      console.error('Error updating SharePoint link:', error);
      setLinkModal(prev => ({ ...prev, validationError: '❌ Failed to update link' }));
    }
  };

  const handleOpenEmailModal = async (task) => {
    if (!task.jobId) {
      showError('No Job ID found for this task.', 'Missing Job ID');
      return;
    }

    setSelectedJobId(task.jobId);
    setSelectedTaskId(task._id);

    // Check cache first for instant loading
    if (emailCache[task.jobId]) {
      console.log('⚡ Loading emails from cache for job:', task.jobId);
      setSelectedTaskEmails(emailCache[task.jobId]);
      setShowEmailModal(true);
      return;
    }

    setLoadingEmailsMap(prev => ({ ...prev, [task._id]: true }));

    let emails = [];
    if (task.emails && Array.isArray(task.emails) && task.emails.length > 0) {
      emails = task.emails;
    } else if (task.emailData && Array.isArray(task.emailData) && task.emailData.length > 0) {
      emails = task.emailData;
    } else if (task.mail && Array.isArray(task.mail) && task.mail.length > 0) {
      emails = task.mail;
    } else if (task.meta?.emails && Array.isArray(task.meta.emails) && task.meta.emails.length > 0) {
      emails = task.meta.emails;
    } else {
      try {
        console.log('📧 Fetching emails from API for job:', task.jobId);
        const res = await ticketAPI.getEmailsByJobId(task.jobId);
        emails = res.data?.emails || res.data || [];
        if (emails.length > 0) {
          setTasks(prev => prev.map(t => t._id === task._id ? { ...t, emails } : t));
        }
      } catch (error) {
        console.error('Email API error:', error);
        showError('Failed to fetch emails. Please try again.', 'Error Fetching Emails');
        setLoadingEmailsMap(prev => ({ ...prev, [task._id]: false }));
        return;
      }
    }

    // Cache the emails for instant future access
    if (emails.length > 0) {
      console.log('💾 Caching emails for job:', task.jobId);
      setEmailCache(prev => ({ ...prev, [task.jobId]: emails }));
    }

    setSelectedTaskEmails(emails);
    setShowEmailModal(true);
    setLoadingEmailsMap(prev => ({ ...prev, [task._id]: false }));
  };

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setSelectedJobId(null);
    setSelectedTaskId(null);
    setSelectedTaskEmails([]);
  };

  const handleBarClick = (task) => {
    setSelectedTaskForDetails(task.ticket);
    setShowTicketDetails(true);
  };

  const stats = getGroupStats();

  // Gantt Chart Utilities
  const parseEstimateToMinutes = (estStr) => {
    if (!estStr) return 60; // Default 1 hour if no estimate
 
    const hhmm = estStr.match(/(\d+)h\s*(\d+)m/);
    if (hhmm) {
      return parseInt(hhmm[1]) * 60 + parseInt(hhmm[2]);
    }
 
    const colon = estStr.match(/(\d+):(\d+)/);
    if (colon) {
      return parseInt(colon[1]) * 60 + parseInt(colon[2]);
    }
 
    const hoursOnly = estStr.match(/^(\d+)$/);
    if (hoursOnly) {
      return parseInt(hoursOnly[1]) * 60;
    }
 
    return 60;
  };

  const buildGanttChart = (tasks) => {
    const now = new Date();
    const memberStartTime = user?.startTime || '08:00';
    const [startHour, startMinute] = memberStartTime.split(':').map(Number);
    const todayStartForMember = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute, 0);
   
    let currentTime = new Date(todayStartForMember);
   
    const breakStart = new Date(currentTime);
    breakStart.setHours(13, 0, 0, 0);
    const breakEnd = new Date(currentTime);
    breakEnd.setHours(14, 0, 0, 0);

    if (currentTime >= breakStart && currentTime < breakEnd) {
        currentTime = new Date(breakEnd);
    }

    const memberJobs = [];

    const calculatePerMemberEstimate = (ticket) => {
      const numMembers = ticket.assignedInfo?.teamMembers?.length || 1;
      if (ticket.meta?.remainingSeconds !== undefined && ticket.meta?.remainingSeconds !== null) {
        const remainingMinutes = Math.round(ticket.meta.remainingSeconds / 60);
        return numMembers > 1 ? Math.round(remainingMinutes / numMembers) : remainingMinutes;
      }
      const totalEstimateMinutes = parseEstimateToMinutes(ticket.meta?.teamEst);
      return numMembers > 1 ? Math.round(totalEstimateMinutes / numMembers) : totalEstimateMinutes;
    };

    tasks.sort((a, b) => {
      const aInProgress = a.status === 'in_process';
      const bInProgress = b.status === 'in_process';
      if (aInProgress && !bInProgress) return -1;
      if (!aInProgress && bInProgress) return 1;
      if (aInProgress && bInProgress) {
        const aTime = a.startedAt ? new Date(a.startedAt) : new Date(a.createdAt);
        const bTime = b.startedAt ? new Date(b.startedAt) : new Date(b.createdAt);
        return aTime - bTime;
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    let hasActiveTask = false;

    tasks.forEach(ticket => {
      const estimateMinutes = calculatePerMemberEstimate(ticket);
     
      if (currentTime >= breakStart && currentTime < breakEnd) {
          currentTime = new Date(breakEnd);
      }

      let startTime;
      if (ticket.startedAt && ticket.status === 'in_process' && !hasActiveTask) {
        startTime = new Date(ticket.startedAt);
        hasActiveTask = true;
      } else {
        startTime = new Date(currentTime);
      }
      let endTime = new Date(startTime.getTime() + estimateMinutes * 60000);

      if (startTime < breakStart && endTime > breakStart) {
          endTime = new Date(endTime.getTime() + 60 * 60000);
      }

      memberJobs.push({
        id: `${ticket._id}-${user.name}`,
        jobId: ticket.jobId || 'N/A',
        status: ticket.status,
        estimateMinutes: estimateMinutes,
        startTime: startTime,
        endTime: endTime,
        ticket: ticket
      });
      currentTime = endTime;
    });
   
    setGanttData([{ memberName: user.name, jobs: memberJobs }]);
  };

  useEffect(() => {
    if (tasks.length > 0) {
      buildGanttChart(tasks);
    }
  }, [tasks]);

  const calculateJobLanes = (jobs) => {
    const sortedJobs = [...jobs].sort((a, b) => a.startTime - b.startTime);
    const lanes = [];
    sortedJobs.forEach(job => {
      let laneIndex = 0;
      let placed = false;
      while (!placed) {
        if (!lanes[laneIndex]) {
          lanes[laneIndex] = [];
        }
        const overlaps = lanes[laneIndex].some(existingJob => {
          return job.startTime < existingJob.endTime && job.endTime > existingJob.startTime;
        });
        if (!overlaps) {
          lanes[laneIndex].push(job);
          job.lane = laneIndex;
          placed = true;
        } else {
          laneIndex++;
        }
      }
    });
    return lanes.length;
  };

  const getStatusColor = (status) => {
    const colors = {
      assigned: 'bg-orange-400',
      in_process: 'bg-teal-500',
      paused: 'bg-amber-400',
      rf_qc: 'bg-purple-500',
      qcd: 'bg-green-500',
      file_received: 'bg-blue-500',
      sent: 'bg-indigo-500',
      cancelled: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };
 
  const getStatusTextColor = (status) => {
    switch (status) {
      case 'paused':
      case 'file_received':
        return 'text-black';
      default:
        return 'text-white';
    }
  };
 
  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };
 
  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };
 
  const getTimelinePosition = (startTime, endTime) => {
    const dayStart = new Date(startTime);
    dayStart.setHours(8, 0, 0, 0);
    const dayEnd = new Date(startTime);
    dayEnd.setHours(20, 0, 0, 0);
 
    const totalMinutes = 12 * 60;
    const startMinutes = (startTime - dayStart) / 60000;
    const durationMinutes = (endTime - startTime) / 60000;
 
    const leftPercent = Math.max(0, Math.min(100, (startMinutes / totalMinutes) * 100));
    const widthPercent = Math.max(0.5, Math.min(100 - leftPercent, (durationMinutes / totalMinutes) * 100));
 
    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  };
 
  const hourMarkers = Array.from({ length: 13 }, (_, i) => {
    const hour = 8 + i;
    const displayHour = hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return { hour, display: `${displayHour} ${ampm}`, percent: (i / 12) * 100 };
  });
 
  const getCurrentTimePosition = () => {
    const now = currentTime;
    const dayStart = new Date(now);
    dayStart.setHours(8, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(20, 0, 0, 0);
 
    if (now < dayStart || now > dayEnd) {
      return null;
    }
 
    const totalMinutes = 12 * 60;
    const currentMinutes = (now - dayStart) / 60000;
    const percent = (currentMinutes / totalMinutes) * 100;
 
    return percent;
  };
 
    const currentTimePercent = getCurrentTimePosition();
 
    const [selectedJob, setSelectedJob] = useState(null);
 
  
 
    return (
    <div className="p-2 bg-white h-screen overflow-y-auto text-[13px]">
      {/* Active Task Estimation Cards (Remaining & Estimated End) */}
      {(() => {
        const activeTask = tasks.find(t => t.status === 'in_process');
          if (activeTask && (activeTask.meta?.teamEst || activeTask.meta?.remainingSeconds != null) && activeTask.meta?.startedAt) {
          const estCalc = calculatePerPersonEstimation(activeTask);
          const isMultiAssigned = estCalc && estCalc.count > 1;

          return (
            <div className="mb-4 flex items-stretch gap-3">
              <div className="bg-white border border-gray-200 rounded-lg p-3 w-44 shadow-md hover:shadow-lg transition-shadow">
                <div className="text-xs text-gray-500">
                  Remaining
                  {isMultiAssigned && (
                    <span className="ml-1 text-[10px] text-indigo-600 font-semibold" title={`Your allocated time (${estCalc.count} team members)`}>
                      (Your Share)
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold text-blue-600">{formatCountdown(activeCountdown.remaining)}</div>
                <div className="text-xs text-gray-400 mt-1">Progress: {activeCountdown.percent}%</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-3 w-56 shadow-md hover:shadow-lg transition-shadow">
                <div className="text-xs text-gray-500">Estimated End</div>
                <div className="text-sm font-semibold text-gray-800">{activeCountdown.endTime ? formatDateTime(activeCountdown.endTime) : '-'}</div>
                <div className="text-xs text-gray-400 mt-1">{activeTask.jobId} · {activeTask.clientName}</div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {selectedJob && (
        <TicketDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-sm">Loading your tasks...</p>
        </div>
      ) : tasks.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No tasks yet</h3>
          <p className="text-gray-500 text-sm">
            Tasks assigned to you will appear here
          </p>
        </div>
      ) : (
        <>
          {/* Grouped Tasks Display */}
          <div className="space-y-3">
            {Object.entries(TASK_GROUPS)
              .filter(([groupId]) => {
                // Only show groups that have tasks
                const groupTasks = getTasksForGroup(groupId);
                return groupTasks.length > 0;
              })
              .map(([groupId, group]) => {
            const groupTasks = getTasksForGroup(groupId);
            const count = groupTasks.length;
            const isCollapsed = collapsedGroups[groupId];

            return (
              <div key={groupId} className="bg-white border border-gray-200 rounded overflow-hidden">
                {/* Group Header */}
                <div
                  className="px-3 py-2 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleGroupCollapse(groupId)}
                >
                  <div className="flex items-center gap-2">
                    <button className="p-0.5">
                      {isCollapsed ? (
                        <ChevronRight size={12} className="text-gray-500" />
                      ) : (
                        <ChevronDown size={12} className="text-gray-500" />
                      )}
                    </button>
                    <div className={`${group.bgColor} text-white px-3 py-1 rounded-md font-medium text-[12px]`}>
                      {group.label} <span className="ml-1 text-[11px] font-semibold">({count})</span>
                    </div>
                  </div>
                  {isCollapsed && count > 0 && (
                    <span className="text-[10px] text-gray-500">
                      {count} hidden
                    </span>
                  )}
                </div>

                {/* Group Content */}
                {!isCollapsed && (
                  <>
                    {count === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500">
                        <p className="text-sm">No {group.label.toLowerCase()} at the moment</p>
                      </div>
                    ) : (
                      <>
                        {/* Table Header */}
                        <div className="grid-cols-19 grid gap-x-3 px-3 py-1.5 bg-white border-b border-gray-200 text-[12px] font-bold text-gray-700">
                          <span className="col-span-1 truncate">Job ID</span>
                          <span className="col-span-3 truncate">Client</span>
                          <span className="col-span-1 truncate">Client Type</span>
                          <span className="col-span-2 truncate">Consultant</span>
                          <span className="col-span-2 truncate">Team Members</span>
                          <span className="col-span-2 truncate">File Output</span>
                          <span className="col-span-1 truncate">Proofread</span>
                          <span className="col-span-2 truncate">Status</span>
                          <span className="col-span-1 truncate">Estimate</span>
                          <span className="col-span-2 truncate">Deadline</span>
                          <span className="col-span-1 text-center truncate">Actions</span>
                          <span className="col-span-1 text-center">Mail</span>
                        </div>

                        {/* Task Rows - Minimalistic with Color Coding */}
                        {groupTasks.map((task) => {
                          const isActive = task.status === 'in_process';
                          const estimationDisabled = task.meta?.teamEst && task.meta.teamEst.trim() !== '';
                          const statusColors = {
                            assigned: 'from-orange-400 to-orange-500',
                            in_process: 'from-blue-400 to-blue-500',
                            rf_qc: 'from-purple-400 to-purple-500',
                            qcd: 'from-green-400 to-green-500',
                            file_received: 'from-pink-400 to-pink-500',
                            sent: 'from-teal-400 to-teal-500',
                            not_assigned: 'from-red-400 to-red-500'
                          };
                          return (
                          <div key={task._id}>
                          <div
                            className={`grid grid-cols-19 gap-x-3 items-center px-3 py-1.5 border-b border-gray-100 transition-all ${
                              isActive
                                ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-l-blue-500 shadow-sm'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            {/* Job ID */}
                            <div className="col-span-1">
                              <span
                                className="font-semibold text-blue-600 text-[11px] underline cursor-pointer hover:text-blue-800"
                                onClick={() => {
                                  setViewTask(task);
                                  setShowQCViewModal(true);
                                }}
                                title="Click to view job details and QC feedback"
                              >
                                {task.jobId || '-'}
                              </span>
                            </div>

                            {/* Client */}
                            <div className="col-span-3">
                              <span className="text-[11px] text-gray-800 font-medium truncate block" title={task.clientName}>
                                {task.clientName || '-'}
                              </span>
                            </div>

                            {/* Client Type - Read Only */}
                            <div className="col-span-1">
                              <div className="flex flex-wrap gap-0.5">
                                {(() => {
                                  const clientTypes = Array.isArray(task.meta?.clientType)
                                    ? task.meta.clientType
                                    : task.meta?.clientType ? [task.meta.clientType] : [];
                                  const typeColors = {
                                    'New Client': 'bg-blue-500 text-white',
                                    'New Contact': 'bg-cyan-500 text-white',
                                    'Double Check': 'bg-orange-500 text-white',
                                    'Non Standard': 'bg-red-500 text-white',
                                    'Level 1': 'bg-green-500 text-white',
                                    'Level 2': 'bg-teal-500 text-white',
                                    'Level 3': 'bg-indigo-500 text-white',
                                    'Level 4': 'bg-purple-500 text-white',
                                    'Basic Template': 'bg-lime-500 text-white',
                                    'Premium Template': 'bg-amber-500 text-white',
                                    'Signature Template': 'bg-pink-500 text-white'
                                  };
                                  return clientTypes.length > 0 ? (
                                    clientTypes.map((type, idx) => (
                                      <span
                                        key={idx}
                                        className={`px-1 py-0.5 rounded text-[9px] font-medium truncate ${typeColors[type] || 'bg-gray-500 text-white'}`}
                                        title={type}
                                      >
                                        {type}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[11px] text-gray-400">-</span>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Consultant */}
                            <div className="col-span-2">
                              <span className="text-[11px] text-gray-700 truncate block" title={task.consultantName}>
                                {task.consultantName || '-'}
                              </span>
                            </div>

                            {/* Team Members */}
                            <div className="col-span-2">
                              <div className="flex flex-wrap gap-1">
                                {(() => {
                                  // Get team members from assignedInfo
                                  const teamMembers = task.assignedInfo?.teamMembers || [];
                                  const owner = task.assignedInfo?.owner;
                                  const empName = task.assignedInfo?.empName;

                                  // If teamMembers array is empty but empName exists, use empName
                                  const members = teamMembers.length > 0 ? teamMembers : (empName ? [empName] : []);

                                  if (members.length === 0) {
                                    return <span className="text-[11px] text-gray-400">-</span>;
                                  }

                                  // Calculate per-person estimation for tooltip
                                  const estCalc = calculatePerPersonEstimation(task);
                                  const timeInfo = estCalc && estCalc.count > 1
                                    ? ` - ${estCalc.perPerson} allocated`
                                    : '';

                                  return members.map((member, idx) => {
                                    const isOwner = member === owner;
                                    const tooltip = isOwner
                                      ? `${member} (Owner)${timeInfo}`
                                      : `${member}${timeInfo}`;

                                    return (
                                      <span
                                        key={idx}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                          isOwner
                                            ? 'bg-blue-600 text-white border border-blue-700'
                                            : 'bg-gray-100 text-gray-700 border border-gray-300'
                                        }`}
                                        title={tooltip}
                                      >
                                        {isOwner && '👤 '}{member}
                                      </span>
                                    );
                                  });
                                })()}
                              </div>
                            </div>

                            {/* File Output */}
                            <div className="col-span-2">
                              <MultiSelectDropdown
                                selectedValues={Array.isArray(task.meta?.fileOutput) ? task.meta.fileOutput : (task.meta?.fileOutput ? [task.meta.fileOutput] : [])}
                                onChange={(values) => handleFileOutputChange(task, values)}
                                options={FILE_OUTPUT_OPTIONS}
                                placeholder="-"
                                size="small"
                              />
                            </div>
                            
                            {/* Proofread */}
                            <div className="col-span-1">
                              <ModernDropdown
                                value={task.meta?.proofread || false}
                                onChange={(value) => handleProofreadChange(task, value)}
                                options={[
                                  { label: 'Yes', value: true },
                                  { label: 'No', value: false }
                                ]}
                                placeholder="Select"
                                width="w-full"
                                colorClass={
                                  task.meta?.proofread
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-600'
                                }
                              />
                            </div>

                            {/* Status */}
                            <div className="col-span-2">
                              {(() => {
                                let dropdownOptions = [
                                  { value: 'assigned', label: 'Assigned' },
                                  { value: 'in_process', label: 'In Progress' },
                                  { value: 'paused', label: 'Paused' },
                                  { value: 'rf_qc', label: 'Ready for QC' },
                                  { value: 'qcd', label: 'QC Done' },
                                  { value: 'qc_edits', label: 'QC Edits' },
                                  { value: 'file_received', label: 'File Received' },
                                  { value: 'sent', label: 'Sent' },
                                  { value: 'on_hold', label: 'On Hold' },
                                  { value: 'tbc', label: 'TBC' },
                                  { value: 'cancelled', label: 'Cancelled' }
                                ];

                                if (task.status === 'paused') {
                                  // When paused, offer only Resume Task (in_process)
                                  dropdownOptions = [
                                    { value: 'paused', label: 'Paused', disabled: true }, // Current state, not selectable
                                    { value: 'in_process', label: 'Resume Task', disabled: false }, // Always allow resuming
                                  ];
                                } else {
                                  // For other statuses, apply general rules
                                  dropdownOptions = dropdownOptions.map(option => {
                                    if (option.value === 'assigned' && task.status === 'in_process') {
                                      return { ...option, disabled: true };
                                    }
                                    if (option.value === 'in_process' && !canStartTask(task)) {
                                      return { ...option, disabled: true };
                                    }
                                    if (option.value === task.status) { // Disable current status
                                      return { ...option, disabled: true };
                                    }
                                    return option;
                                  });
                                }

                                return (
                                  <ModernDropdown
                                    value={task.status}
                                    onChange={(newStatus) => updateTaskStatus(task._id, newStatus)}
                                    options={dropdownOptions}
                                    placeholder="Change Status"
                                    colorClass={STATUS_BADGE_BG[task.status]}
                                  />
                                );
                              })()}
                            </div>

                            {/* Estimate */}
                            <div className="col-span-1">
                              {estimationDisabled ? (
                                (() => {
                                  const estCalc = calculatePerPersonEstimation(task);
                                  if (!estCalc) {
                                    return (
                                      <span className="text-[11px] text-gray-600 font-semibold bg-gray-100 px-2 py-1 rounded block text-center">
                                        N/A
                                      </span>
                                    );
                                  }

                                  // If multiple assignees, show both total and per-person
                                  if (estCalc.count > 1) {
                                    return (
                                      <div className="text-[11px] text-gray-600 font-semibold bg-gray-100 px-2 py-1 rounded text-center">
                                        <div className="text-blue-700">{estCalc.total}</div>
                                        <div className="text-[10px] text-gray-500 border-t border-gray-300 mt-0.5 pt-0.5">
                                          {estCalc.perPerson}
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Single assignee - show total only
                                  return (
                                    <span className="text-[11px] text-gray-600 font-semibold bg-gray-100 px-2 py-1 rounded block text-center">
                                      {estCalc.total}
                                    </span>
                                  );
                                })()
                              ) : (
                                (() => {
                                  const userCanSetEst = canSetEstimation(task);
                                  const isMultiAssigned = hasMultipleAssignees(task);

                                  if (!userCanSetEst && isMultiAssigned) {
                                    // Non-owner with multiple assignees - show locked state
                                    return (
                                      <button
                                        onClick={() => {
                                          console.log('🔒 LOCKED - Estimation access denied:', {
                                            jobId: task.jobId,
                                            currentUser: { name: user.name, email: user.email },
                                            taskOwner: task.assignedInfo?.owner,
                                            teamMembers: task.assignedInfo?.teamMembers,
                                            empName: task.assignedInfo?.empName,
                                            isMultiAssigned,
                                            userCanSetEst
                                          });
                                          const owner = task.assignedInfo?.owner || task.assignedInfo?.teamMembers?.[0] || 'the owner';
                                          showWarning(
                                            `This task is assigned to multiple team members.\n\nOnly the task owner (${owner}) can set the estimation.`,
                                            'Owner Only'
                                          );
                                        }}
                                        className="text-[11px] font-semibold bg-gray-100 text-gray-500 px-2 py-1 rounded block w-full text-center cursor-not-allowed"
                                        title={`Only ${task.assignedInfo?.owner || 'owner'} can set estimation`}
                                      >
                                        🔒 Set Est.
                                      </button>
                                    );
                                  }

                                  // User can set estimation
                                  return (
                                    <button
                                      onClick={() => handleEstimateChange(task, 0, '00')}
                                      className="text-[11px] font-semibold bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded block w-full text-center transition-colors"
                                      title="Click to set estimation"
                                    >
                                      Set Est.
                                    </button>
                                  );
                                })()
                              )}
                            </div>

                            {/* Deadline */}
                            <div className="col-span-2">
                              <span className="text-[11px] text-gray-600 flex items-center gap-1">
                                {task.meta?.deadline ? (
                                  <>
                                    <Clock size={11} className="text-orange-500" />
                                    <span className="font-medium">{formatDeadlineDisplay(task.meta.deadline, task.meta?.timezone)}</span>
                                  </>
                                ) : (
                                  <span className="text-gray-400 italic">-</span>
                                )}
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="col-span-1 flex gap-1.5 justify-center">
                              {['assigned', 'paused'].includes(task.status) && (
                                <button
                                  onClick={() => handleStartTask(task)}
                                  disabled={!canStartTask(task)}
                                  className={`px-2 py-1 rounded-lg ${!canStartTask(task) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'} transition-all text-[10px] font-bold`}
                                  title={!canStartTask(task) ? "Please fill in Estimate, File Output, and Proofread fields first" : (task.status === 'paused' ? 'Resume Task' : 'Start Task')}
                                >
                                  {task.status === 'paused' ? 'Resume' : 'Start'}
                                </button>
                              )}
                              {task.status === 'in_process' && (
                                <>
                                  <button
                                    onClick={() => handlePauseTask(task)}
                                    className="px-1.5 py-1 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white transition-all text-[10px] font-bold"
                                    title="Pause Task"
                                  >
                                    ⏸
                                  </button>
                                  <button
                                    onClick={() => handleEndTask(task)}
                                    className="px-1.5 py-1 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-all text-[10px] font-bold"
                                    title="Ready for QC"
                                  >
                                    ✓
                                  </button>
                                </>
                              )}
                              {task.status === 'qcd' && groupId !== 'all' && (
                                <button
                                  onClick={() => handleOpenLinkModal(task)}
                                  className="px-1.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white transition-all text-[10px] font-bold"
                                  title="Upload SharePoint Link"
                                >
                                  🔗 Link
                                </button>
                              )}
                            </div>

                            {/* Email */}
                            <div className="col-span-1 flex justify-center items-center gap-1">
                              <div className="relative">
                                <button
                                  className="h-5 w-5 flex items-center justify-center rounded border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-600 hover:text-blue-800 transition-all"
                                  onClick={() => handleOpenEmailModal(task)}
                                  title={`View emails for ${task.jobId} (${task.emails?.length || 0} email${task.emails?.length !== 1 ? 's' : ''})`}
                                  disabled={loadingEmailsMap[task._id]}
                                >
                                  {loadingEmailsMap[task._id] ? (
                                    <div className="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <Mail size={12} />
                                  )}
                                </button>
                              </div>
                              <span className={`text-[10px] font-bold ${
                                (task.emails?.length || 0) > 0
                                  ? 'text-blue-600'
                                  : 'text-gray-400'
                              }`}>
                                ({task.emails?.length || 0})
                              </span>
                            </div>
                          </div>

                          {/* QC Feedback Section - Shows when feedback exists */}
                          {task.qcFeedback && Object.keys(task.qcFeedback).length > 0 && (
                            <div className="mt-2 mb-2 mx-3 px-3">
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 shadow-sm">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-300">
                                  <span className="text-[13px] font-bold text-blue-800">📋 QC Feedback</span>
                                  <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-semibold">
                                    Updated by Team Lead
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  {/* Quality */}
                                  {task.qcFeedback.quality && (
                                    <div className="bg-white rounded-md p-2 border border-green-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Quality</div>
                                      <div className="text-[12px] font-bold text-green-700">{task.qcFeedback.quality}</div>
                                    </div>
                                  )}

                                  {/* Slide Count */}
                                  {task.qcFeedback.slideCount && (
                                    <div className="bg-white rounded-md p-2 border border-blue-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Slide Count</div>
                                      <div className="text-[12px] font-bold text-blue-700">{task.qcFeedback.slideCount}</div>
                                    </div>
                                  )}

                                  {/* Slide with Error */}
                                  {task.qcFeedback.slideWithError && (
                                    <div className="bg-white rounded-md p-2 border border-red-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Slide with Error</div>
                                      <div className="text-[12px] font-bold text-red-700">{task.qcFeedback.slideWithError}</div>
                                    </div>
                                  )}

                                  {/* Content */}
                                  {task.qcFeedback.content && (
                                    <div className="bg-white rounded-md p-2 border border-purple-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Content</div>
                                      <div className="text-[12px] font-bold text-purple-700">{task.qcFeedback.content}</div>
                                    </div>
                                  )}

                                  {/* Instruction Missed */}
                                  {task.qcFeedback.instructionMissed && (
                                    <div className="bg-white rounded-md p-2 border border-orange-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Instruction Missed</div>
                                      <div className="text-[12px] font-bold text-orange-700">{task.qcFeedback.instructionMissed}</div>
                                    </div>
                                  )}

                                  {/* Layout */}
                                  {task.qcFeedback.layout && (
                                    <div className="bg-white rounded-md p-2 border border-teal-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Layout</div>
                                      <div className="text-[12px] font-bold text-teal-700">{task.qcFeedback.layout}</div>
                                    </div>
                                  )}

                                  {/* Format */}
                                  {task.qcFeedback.format && (
                                    <div className="bg-white rounded-md p-2 border border-indigo-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Format</div>
                                      <div className="text-[12px] font-bold text-indigo-700">{task.qcFeedback.format}</div>
                                    </div>
                                  )}

                                  {/* Format - Table */}
                                  {task.qcFeedback.formatTable && (
                                    <div className="bg-white rounded-md p-2 border border-cyan-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Format - Table</div>
                                      <div className="text-[12px] font-bold text-cyan-700">{task.qcFeedback.formatTable}</div>
                                    </div>
                                  )}

                                  {/* Format - Chart */}
                                  {task.qcFeedback.formatChart && (
                                    <div className="bg-white rounded-md p-2 border border-pink-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Format - Chart</div>
                                      <div className="text-[12px] font-bold text-pink-700">{task.qcFeedback.formatChart}</div>
                                    </div>
                                  )}

                                  {/* Global Check */}
                                  {task.qcFeedback.globalCheck && (
                                    <div className="bg-white rounded-md p-2 border border-amber-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">Global Check</div>
                                      <div className="text-[12px] font-bold text-amber-700">{task.qcFeedback.globalCheck}</div>
                                    </div>
                                  )}

                                  {/* FTR/AOQ */}
                                  {task.qcFeedback.ftrAoq && (
                                    <div className="bg-white rounded-md p-2 border border-emerald-200 shadow-sm">
                                      <div className="text-[10px] font-semibold text-gray-600 mb-1">FTR/AOQ</div>
                                      <div className="text-[12px] font-bold text-emerald-700">{task.qcFeedback.ftrAoq}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          </div>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
          </div>
        </>
      )}

      {/* EMAIL MODAL */}
        {showEmailModal && (
          <EmailModal
            jobId={selectedJobId}
            taskId={selectedTaskId}
            emails={selectedTaskEmails}
            onClose={closeEmailModal}
          />
        )}
        {showTicketDetails && (
          <TicketDetailsModal
            ticket={selectedTaskForDetails}
            onClose={() => setShowTicketDetails(false)}
          />
        )}

      {/* QC FEEDBACK VIEW MODAL */}
      {showQCViewModal && viewTask && (
        <QCFeedbackViewModal
          ticket={viewTask}
          onClose={() => {
            setShowQCViewModal(false);
            setViewTask(null);
          }}
        />
      )}

      {/* ESTIMATION CONFIRMATION MODAL */}
      {estimationModal.show && (() => {
        const modalTask = estimationModal.task || tasks.find(t => t._id === estimationModal.taskId);
        const isMultiAssigned = modalTask && hasMultipleAssignees(modalTask);
        const owner = modalTask?.assignedInfo?.owner;

        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEstimationModal({ show: false, taskId: null, hours: 0, minutes: '00' })}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-gray-800 mb-4">Set Task Estimation</h2>
              <p className="text-gray-600 text-sm mb-4">Please enter hours and minutes for your estimation</p>

              {/* Multi-assignee info */}
              {isMultiAssigned && owner && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 text-lg">👥</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">Multiple Team Members</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Task Owner: <span className="font-bold">{owner}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-6">
              {/* Hours Dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hours</label>
                <select
                  value={estimationModal.hours}
                  onChange={(e) => {
                    setEstimationModal({ ...estimationModal, hours: parseInt(e.target.value) });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold bg-white"
                >
                  {Array.from({ length: 1000 }, (_, i) => i).map(hour => (
                    <option key={hour} value={hour}>{hour}</option>
                  ))}
                </select>
              </div>

              {/* Minutes Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Minutes</label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={parseInt(estimationModal.minutes) || 0}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    const clampedValue = Math.min(Math.max(value, 0), 59);
                    setEstimationModal({ ...estimationModal, minutes: clampedValue.toString().padStart(2, '0') });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-semibold"
                  placeholder="Enter minutes (0-59)"
                />
              </div>

              {/* Preview */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-sm text-gray-600 mb-1">Total estimated time:</p>
                <p className="text-2xl font-bold text-blue-600">
                  {estimationModal.hours}h {estimationModal.minutes}m
                </p>

                {/* Show division if multiple team members */}
                {isMultiAssigned && (() => {
                  const totalMinutes = (estimationModal.hours * 60) + parseInt(estimationModal.minutes || 0);
                  const memberCount = modalTask?.assignedInfo?.teamMembers?.length || 1;
                  const perPersonMinutes = totalMinutes / memberCount;
                  const perPersonHours = Math.floor(perPersonMinutes / 60);
                  const perPersonMins = Math.round(perPersonMinutes % 60);

                  return (
                    <div className="mt-3 pt-3 border-t border-blue-300">
                      <p className="text-sm text-gray-600 mb-1">
                        Per person ({memberCount} team members):
                      </p>
                      <p className="text-xl font-bold text-indigo-600">
                        {perPersonHours}h {perPersonMins.toString().padStart(2, '0')}m each
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ({(perPersonMinutes / 60).toFixed(2)} hours each)
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setEstimationModal({ show: false, taskId: null, hours: 0, minutes: '00' })}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEstimation}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Confirm Estimation
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* START TASK CONFIRMATION MODAL */}
      {startConfirmModal.show && startConfirmModal.task && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setStartConfirmModal({ show: false, task: null, onConfirm: null })}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg transform transition-all" onClick={(e) => e.stopPropagation()}>
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-2xl p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">▶️</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Start Task</h2>
                  <p className="text-blue-100 text-sm">Confirm to begin working</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Task Details Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 font-semibold text-sm min-w-[80px]">Job ID:</span>
                    <span className="text-gray-900 font-bold">{startConfirmModal.task.jobId}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 font-semibold text-sm min-w-[80px]">Client:</span>
                    <span className="text-gray-900">{startConfirmModal.task.clientName}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 font-semibold text-sm min-w-[80px]">Estimation:</span>
                    <div className="flex-1">
                      {(() => {
                        const estCalc = calculatePerPersonEstimation(startConfirmModal.task);
                        if (!estCalc || !estCalc.total) {
                          return <span className="text-gray-900 font-semibold">Not set</span>;
                        }

                        if (estCalc.count > 1) {
                          return (
                            <div>
                              <span className="text-gray-900 font-semibold">{estCalc.total}</span>
                              <span className="text-sm text-indigo-600 font-semibold ml-2">
                                ({estCalc.perPerson} each × {estCalc.count})
                              </span>
                            </div>
                          );
                        }

                        return <span className="text-gray-900 font-semibold">{estCalc.total}</span>;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-blue-600 font-semibold text-sm min-w-[80px]">File Output:</span>
                    <span className="text-gray-900">
                      {Array.isArray(startConfirmModal.task.meta?.fileOutput)
                        ? startConfirmModal.task.meta.fileOutput.join(', ')
                        : (startConfirmModal.task.meta?.fileOutput || 'Not set')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning Message */}
              <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-900 mb-1">Important Notice</h4>
                    <p className="text-amber-800 text-sm">
                      Once you start this task, you cannot go back to 'Assigned' status.
                      Make sure you're ready to begin working on it.
                    </p>
                  </div>
                </div>
              </div>

              {/* Question */}
              <div className="text-center pt-2">
                <p className="text-lg text-gray-700 font-medium">
                  Are you ready to start working on this task?
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setStartConfirmModal({ show: false, task: null, onConfirm: null })}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all transform hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={startConfirmModal.onConfirm}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
              >
                ✓ Start Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERAL NOTIFICATION MODAL */}
      {notificationModal.show && (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={() => setNotificationModal({ ...notificationModal, show: false })}>
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md m-4 text-center" onClick={(e) => e.stopPropagation()}>
            {/* Header with gradient - color based on type */}
            <div className={`rounded-t-2xl p-6 text-white ${
              notificationModal.type === 'error' ? 'bg-gradient-to-r from-red-600 to-rose-600' :
              notificationModal.type === 'warning' ? 'bg-gradient-to-r from-amber-500 to-orange-600' :
              notificationModal.type === 'success' ? 'bg-gradient-to-r from-green-600 to-emerald-600' :
              notificationModal.type === 'confirm' ? 'bg-gradient-to-r from-blue-600 to-indigo-600' :
              'bg-gradient-to-r from-gray-600 to-slate-600'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <span className="text-3xl">
                    {notificationModal.type === 'error' ? '❌' :
                     notificationModal.type === 'warning' ? '⚠️' :
                     notificationModal.type === 'success' ? '✅' :
                     notificationModal.type === 'confirm' ? '❓' :
                     'ℹ️'}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{notificationModal.title}</h2>
                  <p className={`text-sm ${
                    notificationModal.type === 'error' ? 'text-red-100' :
                    notificationModal.type === 'warning' ? 'text-amber-100' :
                    notificationModal.type === 'success' ? 'text-green-100' :
                    notificationModal.type === 'confirm' ? 'text-blue-100' :
                    'text-gray-100'
                  }`}>
                    {notificationModal.type === 'confirm' ? 'Please confirm your action' : 'Notification'}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
                {notificationModal.message}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 pb-6 flex gap-3">
              {notificationModal.showCancel && (
                <button
                  onClick={() => setNotificationModal({ ...notificationModal, show: false })}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all transform hover:scale-105 active:scale-95"
                >
                  {notificationModal.cancelText}
                </button>
              )}
              <button
                onClick={notificationModal.onConfirm}
                className={`${notificationModal.showCancel ? 'flex-1' : 'w-full'} px-6 py-3 font-bold rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl ${
                  notificationModal.type === 'error' ? 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white' :
                  notificationModal.type === 'warning' ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white' :
                  notificationModal.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white' :
                  notificationModal.type === 'confirm' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white' :
                  'bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700 text-white'
                }`}
              >
                {notificationModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHAREPOINT LINK MODAL */}
      {linkModal.show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setLinkModal({ show: false, taskId: null, link: '', validationError: '' })}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Upload SharePoint Link</h2>
            <p className="text-gray-600 text-sm mb-4">Paste your SharePoint/OneDrive link to complete this task</p>
            
            <div className="space-y-4 mb-6">
              {/* Link Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SharePoint Link *</label>
                <input
                  type="url"
                  value={linkModal.link}
                  onChange={(e) => setLinkModal({ ...linkModal, link: e.target.value, validationError: '' })}
                  placeholder="https://company.sharepoint.com/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
                />
              </div>

              {/* Validation Error */}
              {linkModal.validationError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{linkModal.validationError}</p>
                </div>
              )}

              {/* Info */}
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                <p className="text-xs text-cyan-700">
                  <strong>Valid domains:</strong> sharepoint.com, onedrive.microsoft.com, microsoft.sharepoint.com
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setLinkModal({ show: false, taskId: null, link: '', validationError: '' })}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSharePointLink}
                className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-colors"
              >
                Validate & Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <Toast
          message={toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default Tasks;
