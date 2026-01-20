import { useEffect, useState, useRef, useCallback } from "react";
import { Mail, MoreVertical, Eye, EyeOff, Settings, GripVertical, X, Plus, ChevronDown, ChevronRight, Check, AlertCircle, Clock } from "lucide-react";
import { ticketAPI, teamMemberAPI, emailAPI } from "../utils/api";
import DateTimePicker from "../components/DateTimePicker";

/* ===================== HIDE SCROLLBAR STYLES ===================== */
const hideScrollbarStyles = `
  select.hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  select.hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Custom scrollbar styles for ticket container - horizontal and vertical */
  .ticket-scroll::-webkit-scrollbar {
    height: 6px;
    width: 6px;
  }
  .ticket-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .ticket-scroll::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 3px;
  }
  .ticket-scroll::-webkit-scrollbar-thumb:hover {
    background: #d1d5db;
  }
  .ticket-scroll {
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
  }

  /* Custom scrollbar for main page container */
  .page-scroll::-webkit-scrollbar {
    width: 6px;
  }
  .page-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .page-scroll::-webkit-scrollbar-thumb {
    background: #e5e7eb;
    border-radius: 3px;
  }
  .page-scroll::-webkit-scrollbar-thumb:hover {
    background: #d1d5db;
  }
  .page-scroll {
    scrollbar-width: thin;
    scrollbar-color: #e5e7eb transparent;
  }

  /* Hide dropdown arrows and borders by default */
  select.clean-dropdown {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-image: none;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  /* Show border on hover */
  select.clean-dropdown:hover {
    border-color: #e5e7eb;
    background-color: #f9fafb;
  }

  /* Show border and arrow on focus/active */
  select.clean-dropdown:focus,
  select.clean-dropdown:active {
    border-color: #93c5fd;
    background-color: white;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 4px center;
    padding-right: 20px;
  }

  /* Input fields - clean design */
  input.clean-input {
    border: 1px solid transparent;
    transition: all 0.2s ease;
  }

  input.clean-input:hover {
    border-color: #e5e7eb;
    background-color: #f9fafb;
  }

  input.clean-input:focus {
    border-color: #93c5fd;
    background-color: white;
  }

  /* Readonly inputs - subtle style */
  input.clean-input:read-only {
    cursor: default;
  }

  input.clean-input:read-only:hover {
    border-color: transparent;
    background-color: #f3f4f6;
  }
`;

/* ===================== DEFAULT COLUMN CONFIGURATION ===================== */
/* Columns in order: Job ID, Client, Consultant, Client Type, Deadline, TL, Team Member,
   Status, Estimate Time, To Check, New, Edits, Proof read, Mail, Action */
const DEFAULT_COLUMNS = [
  { id: 'jobId', label: 'Job ID', defaultVisible: true },
  { id: 'client', label: 'Client', defaultVisible: true },
  { id: 'consultant', label: 'Consultant', defaultVisible: true },
  { id: 'clientType', label: 'Client Type', defaultVisible: true },
  { id: 'deadline', label: 'Deadline', defaultVisible: true },
  { id: 'teamLead', label: 'TL', defaultVisible: true },
  { id: 'teamMember', label: 'Team Member', defaultVisible: true },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'estimate', label: 'Estimate Time', defaultVisible: true },
  { id: 'toCheck', label: 'To Check', defaultVisible: true },
  { id: 'new', label: 'New', defaultVisible: true },
  { id: 'edits', label: 'Edits', defaultVisible: true },
  { id: 'proofRead', label: 'Proof read', defaultVisible: true },
  { id: 'mail', label: 'Mail', defaultVisible: true },
  { id: 'action', label: 'Action', defaultVisible: true },
  // Hidden columns by default
  { id: 'timezone', label: 'Time Zone', defaultVisible: false },
  { id: 'istTime', label: 'IST Time', defaultVisible: false },
  { id: 'ticketTime', label: 'Ticket Time', defaultVisible: false },
  { id: 'assignTime', label: 'Assign Job Time', defaultVisible: false },
  { id: 'startTime', label: 'Start Job Time', defaultVisible: false },
  { id: 'fileOutput', label: 'File Output', defaultVisible: false }
];

/* ===================== DATE FORMATTER ===================== */
const formatDateTime = (date) => {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
};

/* ===================== TIMEZONE CONVERTER ===================== */
const convertToIST = (datetimeLocal, timezone) => {
  if (!datetimeLocal || !timezone) return "-";

  // Extract UTC offset from timezone string like "EST (UTC-5)"
  const utcMatch = timezone.match(/UTC([+-]\d+:?\d*)/);
  if (!utcMatch) return "-";

  const utcOffset = utcMatch[1];
  const datetime = new Date(datetimeLocal);

  // Parse offset (e.g., "-5" or "+5:30")
  const offsetParts = utcOffset.match(/([+-])(\d+):?(\d*)/);
  if (!offsetParts) return "-";

  const sign = offsetParts[1] === '+' ? 1 : -1;
  const offsetHours = parseInt(offsetParts[2]);
  const offsetMinutes = offsetParts[3] ? parseInt(offsetParts[3]) : 0;
  const totalOffsetMinutes = sign * (offsetHours * 60 + offsetMinutes);

  // Convert to UTC first (reverse the timezone offset)
  const utcTime = new Date(datetime.getTime() - totalOffsetMinutes * 60000);

  // Convert UTC to IST (UTC+5:30)
  const istTime = new Date(utcTime.getTime() + (5.5 * 60 * 60000));

  // Format IST time
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const day = istTime.getDate();
  const month = months[istTime.getMonth()];
  const year = istTime.getFullYear();
  let hours = istTime.getHours();
  const minutes = istTime.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
};

/* ===================== FORMAT DEADLINE DISPLAY ===================== */
const formatDeadlineDisplay = (datetimeLocal, timezone) => {
  if (!datetimeLocal || !timezone) return "-";

  // Extract UTC offset from timezone string like "EST (UTC-5)"
  const utcMatch = timezone.match(/UTC([+-]\d+:?\d*)/);
  if (!utcMatch) return "-";

  const utcOffset = utcMatch[1];
  const datetime = new Date(datetimeLocal);

  // Parse offset (e.g., "-5" or "+5:30")
  const offsetParts = utcOffset.match(/([+-])(\d+):?(\d*)/);
  if (!offsetParts) return "-";

  const sign = offsetParts[1] === '+' ? 1 : -1;
  const offsetHours = parseInt(offsetParts[2]);
  const offsetMinutes = offsetParts[3] ? parseInt(offsetParts[3]) : 0;
  const totalOffsetMinutes = sign * (offsetHours * 60 + offsetMinutes);

  // Convert to UTC first (reverse the timezone offset)
  const utcTime = new Date(datetime.getTime() - totalOffsetMinutes * 60000);

  // Convert UTC to IST (UTC+5:30)
  const istTime = new Date(utcTime.getTime() + (5.5 * 60 * 60000));

  // Get today's date in IST
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

  // Calculate days until next Sunday (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const currentDayOfWeek = istNow.getDay();
  const daysUntilSunday = currentDayOfWeek === 0 ? 0 : 7 - currentDayOfWeek;

  if (diffDays === 0) {
    return `Today, ${timeStr}`;
  } else if (diffDays === 1) {
    return `Tomorrow, ${timeStr}`;
  } else if (diffDays > 1 && diffDays <= daysUntilSunday) {
    // Within current week (up to Sunday)
    const dayName = days[istTime.getDay()];
    return `${dayName}, ${timeStr}`;
  } else {
    // After Sunday - show date and time
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const day = istTime.getDate();
    const month = months[istTime.getMonth()];
    const year = istTime.getFullYear();
    return `${day}-${month}-${year}, ${timeStr}`;
  }
};

/* ===================== CONFIGS ===================== */
const STATUSES = ["not_assigned","assigned","paused","in_process","rf_qc","qcd","file_received","sent","on_hold","tbc","cancelled"];
const STATUS_LABEL = {
  not_assigned: "Not Assigned",
  assigned: "Assigned",
  paused: "Paused",
  in_process: "In Progress",
  rf_qc: "Ready for QC",
  qcd: "QC Done",
  file_received: "File Received",
  sent: "Sent",
  on_hold: "On Hold",
  tbc: "TBC",
  cancelled: "Cancelled"
};
const STATUS_COLOR = {
  not_assigned: "text-red-600",
  assigned: "text-yellow-600",
  paused: "text-indigo-600",
  in_process: "text-blue-600",
  rf_qc: "text-purple-600",
  qcd: "text-green-600",
  file_received: "text-orange-600",
  sent: "text-teal-600",
  on_hold: "text-gray-600",
  tbc: "text-amber-600",
  cancelled: "text-rose-600"
};

const STATUS_BADGE_BG = {
  not_assigned: "bg-red-600",
  assigned: "bg-yellow-600",
  paused: "bg-indigo-600",
  in_process: "bg-blue-600",
  rf_qc: "bg-purple-600",
  qcd: "bg-green-600",
  file_received: "bg-orange-600",
  sent: "bg-teal-600",
  on_hold: "bg-gray-600",
  tbc: "bg-amber-600",
  cancelled: "bg-rose-600"
};

const TO_CHECK_OPTIONS = ["Malar","Ravi","Priyanka","Darshana"];
const CLIENT_TYPES = ["New Client","New Contact","Double Check","Non Standard","Level 1","Level 2","Level 3","Level 4","Basic Template","Premium Template","Signature Template"];
const FILE_OUTPUT_OPTIONS = ["PowerPoint", "Word", "Excel", "PDF", "Google Slides", "Google Docs", "Google Sheets"];
const TIMEZONES = [
  "EST (UTC-5)", "CST (UTC-6)", "MST (UTC-7)", "PST (UTC-8)",
  "GMT (UTC+0)", "CET (UTC+1)", "IST (UTC+5:30)", "JST (UTC+9)",
  "AEST (UTC+10)", "NZST (UTC+12)"
];
const HOURS_OPTIONS = Array.from({ length: 25 }, (_, i) => i); // 0-24
const MINUTES_OPTIONS = ['00', '15', '30', '45'];
const inputClass = "w-full px-0.5 py-0.5 text-[11px] rounded-sm bg-white focus:outline-none h-[20px] clean-input";
const selectClass = "w-full px-0.5 py-0.5 text-[11px] rounded-sm bg-white focus:outline-none h-[20px] clean-dropdown hide-scrollbar";

/* ===================== DEBOUNCE UTILITY ===================== */
const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

/* ===================== SAVE STATUS CONSTANTS ===================== */
const SAVE_STATUS = {
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error'
};

/* ===================== SAVE STATUS INDICATOR ===================== */
const SaveStatusIndicator = ({ status, onRetry }) => {
  if (status === SAVE_STATUS.IDLE) return null;

  return (
    <div className="flex items-center gap-1 text-[10px] font-medium">
      {status === SAVE_STATUS.SAVING && (
        <>
          <Clock size={12} className="text-blue-500 animate-pulse" />
          <span className="text-blue-600">Saving...</span>
        </>
      )}
      {status === SAVE_STATUS.SAVED && (
        <>
          <Check size={12} className="text-green-500" />
          <span className="text-green-600">Saved</span>
        </>
      )}
      {status === SAVE_STATUS.ERROR && (
        <>
          <AlertCircle size={12} className="text-red-500" />
          <span className="text-red-600">Error</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-1 px-2 py-0.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-[9px] transition-colors"
            >
              Retry
            </button>
          )}
        </>
      )}
    </div>
  );
};

/* ===================== COLUMN MANAGER ===================== */
const ColumnManager = ({ columnOrder, visibleColumns, onReorderColumns, onToggleColumn, onResetColumns }) => {
  const [open, setOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...columnOrder];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    onReorderColumns(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const visibleCount = columnOrder.filter(col => visibleColumns[col.id]).length;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all text-xs font-medium text-gray-700"
        title="Manage Columns"
      >
        <Settings size={14} className="text-gray-600" />
        <span>Columns ({visibleCount}/{columnOrder.length})</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-300 rounded z-50 max-h-[550px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-300 bg-gray-50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Settings size={14} className="text-gray-600" />
                <h3 className="font-medium text-sm text-gray-800">Manage Columns</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-gray-600">Drag to reorder • Click to toggle</p>
          </div>

          {/* Column List */}
          <div className="overflow-y-auto flex-1 p-3">
            <div className="space-y-1">
              {columnOrder.map((column, index) => (
                <div
                  key={column.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 px-2 py-2 rounded cursor-move ${
                    draggedIndex === index
                      ? 'opacity-50'
                      : dragOverIndex === index
                      ? 'bg-blue-50 border border-blue-300'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {/* Drag Handle */}
                  <div className="cursor-grab active:cursor-grabbing text-gray-400">
                    <GripVertical size={14} />
                  </div>

                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.id]}
                    onChange={() => onToggleColumn(column.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 text-gray-600 border-gray-300 rounded cursor-pointer"
                  />

                  {/* Column Label */}
                  <span className={`flex-1 text-sm select-none ${
                    visibleColumns[column.id] ? 'text-gray-800' : 'text-gray-500'
                  }`}>
                    {column.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-300 bg-gray-50 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              {visibleCount} of {columnOrder.length} visible
            </div>
            <button
              onClick={onResetColumns}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ===================== EMAIL MODAL ===================== */
const EmailModal = ({ jobId, ticketId, emails, onClose, onRemoveEmail }) => {
  const [expandedEmails, setExpandedEmails] = useState({});

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Make all links in email content open in new tab and style email content
  useEffect(() => {
    const emailContentDivs = document.querySelectorAll('.email-content');
    emailContentDivs.forEach(div => {
      // Style links
      const links = div.querySelectorAll('a');
      links.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
        link.style.color = '#1a73e8';
        link.style.textDecoration = 'none';
        link.style.cursor = 'pointer';
        link.addEventListener('mouseenter', () => {
          link.style.textDecoration = 'underline';
        });
        link.addEventListener('mouseleave', () => {
          link.style.textDecoration = 'none';
        });
      });

      // Style images
      const images = div.querySelectorAll('img');
      images.forEach(img => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '4px';
        img.style.marginTop = '8px';
        img.style.marginBottom = '8px';
      });

      // Style tables (common in emails)
      const tables = div.querySelectorAll('table');
      tables.forEach(table => {
        table.style.borderCollapse = 'collapse';
        table.style.maxWidth = '100%';
      });
    });
  }, [emails]);

  const toggleEmailDetails = (index) => {
    setExpandedEmails(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getInitials = (email) => {
    if (!email) return '?';
    const name = email.split('@')[0];
    return name.charAt(0).toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const emailDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (emailDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (now.getFullYear() === date.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const handleRemoveEmail = async (emailId) => {
    if (!window.confirm('Are you sure you want to remove this email from the ticket? The email will be restored to the Mail page.')) {
      return;
    }

    console.log('Removing email:', emailId, 'from ticket:', ticketId);

    try {
      const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/remove-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ emailId })
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Email removed successfully:', data);
        alert('Email removed successfully and restored to Mail page');
        if (onRemoveEmail) {
          onRemoveEmail(emailId);
        }
      } else {
        const data = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Failed to remove email:', data);
        alert('Failed to remove email: ' + data.message);
      }
    } catch (error) {
      console.error('Error removing email:', error);
      alert('Error removing email from ticket: ' + error.message);
    }
  };

  const handleDownloadAttachment = async (emailId, attachmentId, filename, email) => {
    try {
      // Check if this email has attachment content stored directly (from ticket.emails)
      if (email?.attachments?.[attachmentId]?.content) {
        // Download from ticket's stored email data
        const response = await fetch(`http://localhost:5000/api/tickets/${ticketId}/emails/${emailId}/attachments/${attachmentId}`, {
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
      alert('Failed to download attachment');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white w-[1000px] max-h-[90vh] rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <h2 className="font-normal text-xl text-gray-800">
            Job ID: <span className="font-medium text-gray-900">{jobId}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-2 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Email Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {emails.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">📭</div>
              <p className="text-base">No emails found for this job</p>
              <p className="text-sm text-gray-400 mt-2">Job ID: {jobId}</p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {emails.map((mail, i) => (
                <div key={i} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                  {/* Email Header */}
                  <div className="px-6 py-4">
                    {/* Subject */}
                    <h3 className="text-xl font-normal text-gray-900 mb-4">
                      {mail.subject || '(No Subject)'}
                    </h3>

                    {/* Sender Info */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {getInitials(mail.from)}
                        </div>

                        {/* Sender Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">
                              {mail.from ? mail.from.split('<')[0].trim() || mail.from : 'Unknown Sender'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(mail.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <span>to</span>
                            <span className="font-medium">{mail.to ? (mail.to.length > 50 ? mail.to.substring(0, 50) + '...' : mail.to) : 'me'}</span>
                            {!expandedEmails[i] && (
                              <button
                                onClick={() => toggleEmailDetails(i)}
                                className="ml-1 text-gray-500 hover:text-gray-700"
                              >
                                <ChevronDown size={14} />
                              </button>
                            )}
                          </div>

                          {/* Expanded Details */}
                          {expandedEmails[i] && (
                            <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded border border-gray-200">
                              <div className="mb-1">
                                <span className="font-medium text-gray-700">from:</span>
                                <span className="ml-2">{mail.from}</span>
                              </div>
                              <div className="mb-1">
                                <span className="font-medium text-gray-700">to:</span>
                                <span className="ml-2">{mail.to}</span>
                              </div>
                              <div className="mb-1">
                                <span className="font-medium text-gray-700">date:</span>
                                <span className="ml-2">{mail.date ? new Date(mail.date).toLocaleString() : 'N/A'}</span>
                              </div>
                              <button
                                onClick={() => toggleEmailDetails(i)}
                                className="mt-2 text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <ChevronRight size={14} />
                                <span>Hide details</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => handleRemoveEmail(mail._id)}
                          className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 rounded border border-gray-300 transition-colors flex items-center gap-1.5"
                          title="Remove this email from ticket"
                        >
                          ↩️ Undo
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Attachments */}
                  {mail.attachments && mail.attachments.length > 0 && (
                    <div className="px-6 pb-4">
                      <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-gray-700">
                            {mail.attachments.length} Attachment{mail.attachments.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {mail.attachments.map((attachment, attIdx) => (
                            <button
                              key={attIdx}
                              onClick={() => handleDownloadAttachment(mail._id, attIdx, attachment.filename, mail)}
                              className="group flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-all text-xs"
                            >
                              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                <span className="text-sm">📄</span>
                              </div>
                              <div className="text-left">
                                <div className="font-medium text-gray-900 max-w-[200px] truncate">
                                  {attachment.filename}
                                </div>
                                {attachment.size && (
                                  <div className="text-[10px] text-gray-500">
                                    {Math.round(attachment.size / 1024)} KB
                                  </div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Email Body */}
                  <div className="px-6 pb-6">
                    <div className="text-sm text-gray-800 leading-relaxed">
                      {(() => {
                        // Debug logging
                        console.log('Email body data:', {
                          bodyHtml: mail.bodyHtml,
                          bodyString: typeof mail.body === 'string' ? mail.body : null,
                          bodyHtmlNested: mail.body?.html,
                          bodyTextNested: mail.body?.text,
                          bodyType: typeof mail.body
                        });

                        // Check for HTML content (prioritize HTML over text)
                        const htmlContent = mail.bodyHtml || mail.body?.html;
                        if (htmlContent && typeof htmlContent === 'string' && htmlContent.trim() !== '') {
                          return (
                            <div
                              className="email-content prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: htmlContent }}
                              style={{
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word'
                              }}
                            />
                          );
                        }

                        // Check for plain text content
                        const textContent = (typeof mail.body === 'string' ? mail.body : mail.body?.text) || '';
                        if (textContent.trim() !== '' && textContent !== 'No content') {
                          return <div className="whitespace-pre-wrap font-sans">{textContent}</div>;
                        }

                        // No content available
                        return (
                          <div className="text-center py-8 text-gray-400 italic bg-gray-50 rounded-lg">
                            <div className="text-4xl mb-2">📧</div>
                            <div>No email content available</div>
                            <div className="text-xs mt-2 text-gray-500">
                              Check browser console for debug information
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ===================== GMAIL VIEWER MODAL ===================== */
const GmailViewerModal = ({ emailContent, loading, error, onClose, onRetry }) => {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Make all links open in new tab
  useEffect(() => {
    if (emailContent) {
      const emailDiv = document.querySelector('.gmail-content');
      if (emailDiv) {
        const links = emailDiv.querySelectorAll('a');
        links.forEach(link => {
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
          link.style.color = '#1a73e8';
          link.style.textDecoration = 'none';
        });

        const images = emailDiv.querySelectorAll('img');
        images.forEach(img => {
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.style.borderRadius = '4px';
          img.style.margin = '8px 0';
        });
      }
    }
  }, [emailContent]);

  const handleDownload = (attachment, index) => {
    try {
      console.log('📥 Downloading attachment:', { filename: attachment.filename, hasContent: !!attachment.content });

      let byteArray;

      // Handle different content formats (browser-compatible)
      if (attachment.content?.type === 'Buffer' && Array.isArray(attachment.content?.data)) {
        // MongoDB format: { type: 'Buffer', data: [array of bytes] }
        byteArray = new Uint8Array(attachment.content.data);
      } else if (attachment.content instanceof ArrayBuffer) {
        // ArrayBuffer format
        byteArray = new Uint8Array(attachment.content);
      } else if (attachment.content?.buffer instanceof ArrayBuffer) {
        // Object with ArrayBuffer property
        byteArray = new Uint8Array(attachment.content.buffer);
      } else if (ArrayBuffer.isView(attachment.content)) {
        // TypedArray (Uint8Array, etc.)
        byteArray = new Uint8Array(attachment.content.buffer || attachment.content);
      } else if (attachment.content instanceof Uint8Array) {
        // Already Uint8Array
        byteArray = attachment.content;
      } else if (typeof attachment.content === 'string') {
        // Base64 string - decode it
        const binaryString = window.atob(attachment.content);
        const len = binaryString.length;
        byteArray = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          byteArray[i] = binaryString.charCodeAt(i);
        }
      } else {
        console.error('Unknown attachment content format:', attachment.content);
        throw new Error('Unsupported attachment format');
      }

      const blob = new Blob([byteArray], { type: attachment.contentType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      console.log('✅ Download initiated for:', attachment.filename);
    } catch (error) {
      console.error('❌ Error downloading attachment:', error);
      alert('Failed to download attachment: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
          <h2 className="font-semibold text-xl text-gray-800 flex items-center gap-2">
            <Mail size={20} className="text-blue-500" />
            Email from Gmail
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            title="Close (Esc)"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600 mb-2">Loading email content...</p>
              <p className="text-xs text-gray-500">Fetching from database cache...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Failed to Load Email</h3>
              <p className="text-sm text-gray-600 mb-6 max-w-md text-center">{error}</p>
              <div className="flex gap-3">
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    🔄 Retry
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-md">
                <p className="text-xs text-blue-800 mb-2"><strong>Troubleshooting:</strong></p>
                <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                  <li>Email content may still be syncing from Gmail</li>
                  <li>Wait a few seconds and click Retry</li>
                  <li>Or wait for auto-sync (every 10 seconds)</li>
                </ul>
              </div>
            </div>
          ) : emailContent ? (
            <div className="space-y-4">
              {/* Email metadata */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-700 min-w-[60px]">From:</span>
                  <span className="text-gray-900">
                    {emailContent.from?.name ? `${emailContent.from.name} <${emailContent.from.address}>` : emailContent.from?.address}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-700 min-w-[60px]">Subject:</span>
                  <span className="text-gray-900">{emailContent.subject || '(No Subject)'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-700 min-w-[60px]">Date:</span>
                  <span className="text-gray-900">
                    {emailContent.date ? new Date(emailContent.date).toLocaleString() : '-'}
                  </span>
                </div>
              </div>

              {/* Attachments */}
              {emailContent.attachments && emailContent.attachments.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    📎 Attachments ({emailContent.attachments.length})
                  </h3>
                  <div className="space-y-2">
                    {emailContent.attachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 p-3 rounded hover:bg-gray-100 transition"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-2xl">📄</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {att.filename}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(att.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(att, idx)}
                          className="ml-4 px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition flex-shrink-0"
                        >
                          Download
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email body */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-3">Message</h3>
                {emailContent.html ? (
                  <div
                    className="gmail-content prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: emailContent.html }}
                  />
                ) : emailContent.text ? (
                  <div className="gmail-content whitespace-pre-wrap text-gray-900 font-sans">
                    {emailContent.text}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 italic">
                    No email content available
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Mail size={48} className="mx-auto mb-4 text-gray-300" />
              <p>No email content to display</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ===================== MULTI-SELECT CLIENT TYPE ===================== */
const MultiSelectClientType = ({ selectedTypes = [], allTypes, onAddType, onRemoveType }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSearchQuery('');
      }
    };

    const handleScroll = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSearchQuery('');
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showDropdown]);

  // Get color for each client type
  const getClientTypeColor = (type) => {
    const typeColors = {
      'New Client': { bg: 'bg-blue-500', text: 'text-white' },
      'New Contact': { bg: 'bg-cyan-500', text: 'text-white' },
      'Double Check': { bg: 'bg-orange-500', text: 'text-white' },
      'Non Standard': { bg: 'bg-red-500', text: 'text-white' },
      'Level 1': { bg: 'bg-green-500', text: 'text-white' },
      'Level 2': { bg: 'bg-teal-500', text: 'text-white' },
      'Level 3': { bg: 'bg-indigo-500', text: 'text-white' },
      'Level 4': { bg: 'bg-purple-500', text: 'text-white' },
      'Basic Template': { bg: 'bg-lime-500', text: 'text-white' },
      'Premium Template': { bg: 'bg-amber-500', text: 'text-white' },
      'Signature Template': { bg: 'bg-pink-500', text: 'text-white' },
    };
    return typeColors[type] || { bg: 'bg-gray-500', text: 'text-white' };
  };

  const availableTypes = allTypes.filter(type => !selectedTypes.includes(type))
    .filter(type => type.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className="flex flex-wrap gap-1 items-center min-h-[24px] px-1 py-0.5 rounded cursor-pointer hover:bg-gray-50"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        {selectedTypes.map((type, index) => {
          const typeColor = getClientTypeColor(type);
          return (
            <div
              key={index}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${typeColor.bg} ${typeColor.text} group max-w-[150px]`}
              title={type}
            >
              <span className="text-[10px] font-medium truncate whitespace-nowrap overflow-hidden">
                {type}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveType(type);
                }}
                className="opacity-70 hover:opacity-100 flex-shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}

        <div className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 rounded">
          <Plus size={12} />
          <span className="text-[10px] font-medium">Add</span>
        </div>
      </div>

      {showDropdown && (
        <div className="fixed mt-1 w-64 bg-white border border-gray-200 rounded z-[9999] overflow-hidden"
             style={{
               top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY,
               left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX
             }}>
          <div className="px-3 py-2 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1.5 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-[200px] overflow-y-auto">
            {availableTypes.length > 0 ? (
              availableTypes.map((type, index) => {
                const typeColor = getClientTypeColor(type);
                return (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddType(type);
                      setSearchQuery('');
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                  >
                    <div className={`w-3 h-3 rounded ${typeColor.bg} flex-shrink-0`}></div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="text-[11px] font-medium text-gray-800 truncate whitespace-nowrap" title={type}>
                        {type}
                      </div>
                    </div>
                    <Plus size={12} className="text-gray-400" />
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-8 text-center text-gray-500">
                <div className="text-[11px]">
                  {searchQuery ? `No types found for "${searchQuery}"` : 'All types selected'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ===================== MULTI-SELECT TEAM LEAD ===================== */
const MultiSelectTeamLead = ({ selectedLeads = [], allLeads, onAddLead, onRemoveLead, teamLeadColors = {} }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSearchQuery('');
      }
    };

    const handleScroll = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSearchQuery('');
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showDropdown]);

  // Get team lead color from database teamName field
  const getTeamLeadColor = (leadName) => {
    const teamColorName = teamLeadColors[leadName];

    // Map teamName colors from database to Tailwind classes
    const colorMap = {
      'Red': { bg: 'bg-red-500', text: 'text-white' },
      'Green': { bg: 'bg-green-500', text: 'text-white' },
      'Blue': { bg: 'bg-blue-500', text: 'text-white' },
      'Yellow': { bg: 'bg-yellow-500', text: 'text-white' },
      'Purple': { bg: 'bg-purple-500', text: 'text-white' },
      'Pink': { bg: 'bg-pink-500', text: 'text-white' },
      'Orange': { bg: 'bg-orange-500', text: 'text-white' },
      'Teal': { bg: 'bg-teal-500', text: 'text-white' },
      'Indigo': { bg: 'bg-indigo-500', text: 'text-white' },
      'Cyan': { bg: 'bg-cyan-500', text: 'text-white' },
      'Lime': { bg: 'bg-lime-500', text: 'text-white' },
      'Amber': { bg: 'bg-amber-500', text: 'text-white' },
    };

    return colorMap[teamColorName] || { bg: 'bg-gray-500', text: 'text-white' };
  };

  const availableLeads = allLeads.filter(lead => !selectedLeads.includes(lead))
    .filter(lead => lead.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className="flex flex-wrap gap-1 items-center min-h-[24px] px-1 py-0.5 rounded cursor-pointer hover:bg-gray-50"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        {selectedLeads.map((lead, index) => {
          const leadColor = getTeamLeadColor(lead);
          return (
            <div
              key={index}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${leadColor.bg} ${leadColor.text} group max-w-[150px]`}
              title={lead}
            >
              <span className="text-[10px] font-medium truncate whitespace-nowrap overflow-hidden">
                {lead}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveLead(lead);
                }}
                className="opacity-70 hover:opacity-100 flex-shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}

        <div className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 rounded">
          <Plus size={12} />
          <span className="text-[10px] font-medium">Add</span>
        </div>
      </div>

      {showDropdown && (
        <div className="fixed mt-1 w-64 bg-white border border-gray-200 rounded z-[9999] overflow-hidden"
             style={{
               top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY,
               left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX
             }}>
          <div className="px-3 py-2 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search team leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1.5 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="max-h-[200px] overflow-y-auto">
            {availableLeads.length > 0 ? (
              availableLeads.map((lead, index) => {
                const leadColor = getTeamLeadColor(lead);
                return (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddLead(lead);
                      setSearchQuery('');
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                  >
                    <div className={`w-3 h-3 rounded ${leadColor.bg} flex-shrink-0`}></div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="text-[11px] font-medium text-gray-800 truncate whitespace-nowrap" title={lead}>
                        {lead}
                      </div>
                    </div>
                    <Plus size={12} className="text-gray-400" />
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-8 text-center text-gray-500">
                <div className="text-[11px]">
                  {searchQuery ? `No team leads found for "${searchQuery}"` : 'All team leads assigned'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ===================== MULTI-SELECT TO CHECK ===================== */
const MultiSelectToCheck = ({ selectedNames = [], allNames, onAddName, onRemoveName }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    const handleScroll = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showDropdown]);

  // Get color for each person
  const getToCheckColor = (name) => {
    const nameColors = {
      'Malar': { bg: 'bg-purple-500', text: 'text-white' },
      'Ravi': { bg: 'bg-blue-500', text: 'text-white' },
      'Priyanka': { bg: 'bg-pink-500', text: 'text-white' },
      'Darshana': { bg: 'bg-teal-500', text: 'text-white' },
    };
    return nameColors[name] || { bg: 'bg-gray-500', text: 'text-white' };
  };

  const availableNames = allNames.filter(name => !selectedNames.includes(name));

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        className="flex flex-wrap gap-1 items-center min-h-[24px] px-1 py-0.5 rounded cursor-pointer hover:bg-gray-50"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        {selectedNames.map((name, index) => {
          const nameColor = getToCheckColor(name);
          return (
            <div
              key={index}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${nameColor.bg} ${nameColor.text} group max-w-[120px]`}
              title={name}
            >
              <span className="text-[10px] font-medium truncate whitespace-nowrap overflow-hidden">
                {name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveName(name);
                }}
                className="opacity-70 hover:opacity-100 flex-shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}

        <div className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 rounded">
          <Plus size={12} />
          <span className="text-[10px] font-medium">Add</span>
        </div>
      </div>

      {showDropdown && (
        <div className="fixed mt-1 w-48 bg-white border border-gray-200 rounded z-[9999] overflow-hidden"
             style={{
               top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY,
               left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX
             }}>
          <div className="max-h-[150px] overflow-y-auto">
            {availableNames.length > 0 ? (
              availableNames.map((name, index) => {
                const nameColor = getToCheckColor(name);
                return (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddName(name);
                      setShowDropdown(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                  >
                    <div className={`w-3 h-3 rounded ${nameColor.bg} flex-shrink-0`}></div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="text-[11px] font-medium text-gray-800 truncate whitespace-nowrap" title={name}>
                        {name}
                      </div>
                    </div>
                    <Plus size={12} className="text-gray-400" />
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-8 text-center text-gray-500">
                <div className="text-[11px]">All selected</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ===================== MULTI-SELECT TEAM MEMBER (ClickUp Style) ===================== */
const MultiSelectTeamMember = ({
  selectedMembers = [],
  allMembers,
  onAddMember,
  onRemoveMember,
  teamMap,
  teamMemberColors = {},
  owner = null,
  onSetOwner = () => {}
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullView, setIsFullView] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(null); // Track which member's menu is open
  const [roleMenuPosition, setRoleMenuPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const roleMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSearchQuery('');
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target)) {
        setRoleMenuOpen(null);
      }
    };

    const handleScroll = (event) => {
      // Only close if scrolling outside the dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        setSearchQuery('');
      }
      if (roleMenuOpen) {
        setRoleMenuOpen(null);
      }
    };

    if (showDropdown || roleMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      // Auto-focus search input when dropdown opens
      if (showDropdown) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [showDropdown, roleMenuOpen]);

  // Get team color from database teamName field
  const getTeamColor = (memberName) => {
    // Get the teamName (color) from the database for this member
    const teamColorName = teamMemberColors[memberName];

    // Map teamName colors from database to Tailwind classes
    const colorMap = {
      'Red': { bg: 'bg-red-500', text: 'text-white' },
      'Green': { bg: 'bg-green-500', text: 'text-white' },
      'Blue': { bg: 'bg-blue-500', text: 'text-white' },
      'Yellow': { bg: 'bg-yellow-500', text: 'text-white' },
      'Purple': { bg: 'bg-purple-500', text: 'text-white' },
      'Pink': { bg: 'bg-pink-500', text: 'text-white' },
      'Orange': { bg: 'bg-orange-500', text: 'text-white' },
      'Teal': { bg: 'bg-teal-500', text: 'text-white' },
      'Indigo': { bg: 'bg-indigo-500', text: 'text-white' },
      'Cyan': { bg: 'bg-cyan-500', text: 'text-white' },
      'Lime': { bg: 'bg-lime-500', text: 'text-white' },
      'Amber': { bg: 'bg-amber-500', text: 'text-white' },
    };

    return colorMap[teamColorName] || { bg: 'bg-gray-500', text: 'text-white' };
  };

  // Filter available members based on search query
  const availableMembers = allMembers
    .filter(member => !selectedMembers.includes(member))
    .filter(member => member.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Container */}
      <div
        className="flex flex-wrap gap-1 items-center min-h-[24px] px-1 py-0.5 rounded cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        {/* Selected Members */}
        {selectedMembers.map((member, index) => {
          const teamColor = getTeamColor(member);
          const isOwner = owner === member;
          return (
            <div
              key={index}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${teamColor.bg} ${teamColor.text} group max-w-[180px] relative`}
              title={member}
            >
              {/* Name with Badge */}
              <span
                className="text-[10px] font-medium truncate whitespace-nowrap overflow-hidden cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setRoleMenuPosition({
                    top: rect.bottom + 4,
                    left: rect.left
                  });
                  setRoleMenuOpen(member);
                }}
              >
                {member}
              </span>

              {/* Owner Badge */}
              {isOwner && (
                <span
                  className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[8px] font-bold flex-shrink-0"
                  title="Owner"
                >
                  O
                </span>
              )}

              {/* Remove Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveMember(member);
                }}
                className="opacity-70 hover:opacity-100 flex-shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}

        {/* Add Button */}
        <div className="inline-flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 rounded transition-colors">
          <Plus size={12} />
          <span className="text-[10px] font-medium">Add</span>
        </div>
      </div>

      {/* Dropdown Menu - ClickUp Style */}
      {showDropdown && (
        <div className="fixed mt-1 w-64 bg-white border border-gray-200 rounded-lg z-[9999] overflow-hidden"
             style={{
               top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY,
               left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX
             }}>
          {/* Search Input with View Toggle */}
          <div className="px-3 py-2 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-2 py-1.5 text-[11px] border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullView(!isFullView);
                }}
                className="px-2 py-1.5 text-[10px] font-medium bg-gray-100 hover:bg-gray-200 rounded transition-colors whitespace-nowrap"
                title={isFullView ? "Switch to compact view" : "Switch to full view"}
              >
                {isFullView ? "Compact" : "Full"}
              </button>
            </div>
          </div>

          {/* Member List */}
          <div className={`${isFullView ? 'max-h-[350px]' : 'max-h-[150px]'} overflow-y-auto transition-all duration-200`}>
            {availableMembers.length > 0 ? (
              availableMembers.map((member, index) => {
                const teamLead = Object.entries(teamMap).find(([_, emps]) => emps.includes(member))?.[0];
                const teamColor = getTeamColor(member);
                return (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddMember(member);
                      setSearchQuery('');
                      setShowDropdown(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                  >
                    {/* Color Indicator */}
                    <div className={`w-3 h-3 rounded ${teamColor.bg} flex-shrink-0`}></div>

                    {/* Info */}
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="text-[11px] font-medium text-gray-800 truncate whitespace-nowrap" title={member}>{member}</div>
                      {teamLead && (
                        <div className="text-[9px] text-gray-500 truncate whitespace-nowrap" title={`Team: ${teamLead}`}>
                          Team: {teamLead}
                        </div>
                      )}
                    </div>

                    {/* Plus Icon */}
                    <Plus size={12} className="text-gray-400" />
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-8 text-center text-gray-500">
                <div className="text-[11px]">
                  {searchQuery ? `No members found for "${searchQuery}"` : 'All members assigned'}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {availableMembers.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
              <div className="text-[9px] text-gray-500">
                {searchQuery
                  ? `${availableMembers.length} member${availableMembers.length !== 1 ? 's' : ''} found`
                  : `${availableMembers.length} member${availableMembers.length !== 1 ? 's' : ''} available`
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* Role Assignment Menu */}
      {roleMenuOpen && (() => {
        const isCurrentOwner = owner === roleMenuOpen;

        return (
          <div
            ref={roleMenuRef}
            className="fixed w-36 bg-white border border-gray-300 rounded-lg z-[9999] overflow-hidden"
            style={{ top: `${roleMenuPosition.top}px`, left: `${roleMenuPosition.left}px` }}
          >
            {/* Set/Clear Owner */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetOwner(isCurrentOwner ? null : roleMenuOpen);
                setRoleMenuOpen(null);
              }}
              className={`w-full text-left px-3 py-2 text-[11px] hover:bg-blue-50 transition-colors flex items-center gap-2 ${isCurrentOwner ? 'bg-blue-50' : ''}`}
            >
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[8px] font-bold">
                O
              </span>
              <span className="font-medium">{isCurrentOwner ? '✓ Remove Owner' : 'Set as Owner'}</span>
            </button>
          </div>
        );
      })()}
    </div>
  );
};

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
        <ChevronDown size={12} className={`ml-1 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu - Vertical Layout with Top-to-Bottom Scrolling */}
      {isOpen && (
        <div
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg z-[9999] flex flex-col"
          style={{
            top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY + 2,
            left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX,
            minWidth: dropdownRef.current?.offsetWidth || '150px',
            maxWidth: '300px'
          }}
        >
          {/* Search Input (if searchable) */}
          {searchable && options.length > 5 && (
            <div className="px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
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

          {/* Options List - Vertical Scrollable Container */}
          <div
            className="flex flex-col overflow-y-auto overflow-x-hidden"
            style={{
              maxHeight: '300px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#CBD5E0 #F7FAFC'
            }}
          >
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
                    className={`w-full px-3 py-2 text-[11px] text-left transition-colors flex-shrink-0 ${
                      isDisabled
                        ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                        : isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'hover:bg-blue-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{optLabel}</span>
                      {isSelected && (
                        <svg className="w-3 h-3 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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

    const handleScroll = (event) => {
      // Only close if scrolling outside the dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const toggleOption = (option) => {
    const value = typeof option === 'object' ? option.value : option;
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    console.log('📤 File Output changed:', { previous: selectedValues, new: newValues });
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

      {/* Dropdown Menu - Vertical Layout with Top-to-Bottom Scrolling */}
      {isOpen && (
        <div
          className="fixed bg-white border border-gray-300 rounded-lg shadow-lg z-[9999] flex flex-col"
          style={{
            top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY + 2,
            left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX,
            minWidth: dropdownRef.current?.offsetWidth || '150px',
            maxWidth: '300px'
          }}
        >
          {/* Options List - Vertical Scrollable Container */}
          <div
            className="flex flex-col overflow-y-auto overflow-x-hidden"
            style={{
              maxHeight: '300px',
              scrollbarWidth: 'thin',
              scrollbarColor: '#CBD5E0 #F7FAFC'
            }}
          >
            {options.length > 0 ? (
              options.map((option, index) => {
                const optValue = typeof option === 'object' ? option.value : option;
                const optLabel = typeof option === 'object' ? option.label : option;
                const isSelected = selectedValues.includes(optValue);

                return (
                  <button
                    key={index}
                    onClick={() => toggleOption(option)}
                    className={`w-full px-3 py-2 text-[11px] text-left transition-colors flex items-center gap-2 flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'hover:bg-blue-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500 pointer-events-none flex-shrink-0"
                    />
                    <span className="truncate">{optLabel}</span>
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

/* ===================== EDIT TICKET MODAL ===================== */
const EditTicketModal = ({ ticket, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    jobId: ticket?.jobId || '',
    clientName: ticket?.clientName || '',
    consultantName: ticket?.consultantName || '',
    meta: {
      new: ticket?.meta?.new || '',
      edits: ticket?.meta?.edits || '',
      timezone: ticket?.meta?.timezone || '',
      deadline: ticket?.meta?.deadline || ''
    }
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMetaChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      meta: { ...prev.meta, [field]: value }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-100/80 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <h2 className="text-xl font-bold text-white">Edit Ticket</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Job ID */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Job ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.jobId}
                onChange={(e) => handleChange('jobId', e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Enter Job ID"
              />
            </div>

            {/* Client Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Client Name
              </label>
              <input
                type="text"
                value={formData.clientName}
                onChange={(e) => handleChange('clientName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Enter Client Name"
              />
            </div>

            {/* Consultant Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Consultant Name
              </label>
              <input
                type="text"
                value={formData.consultantName}
                onChange={(e) => handleChange('consultantName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Enter Consultant Name"
              />
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Timezone
              </label>
              <select
                value={formData.meta.timezone}
                onChange={(e) => handleMetaChange('timezone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Select Timezone</option>
                <option value="EST (UTC-5)">EST (UTC-5)</option>
                <option value="CST (UTC-6)">CST (UTC-6)</option>
                <option value="MST (UTC-7)">MST (UTC-7)</option>
                <option value="PST (UTC-8)">PST (UTC-8)</option>
                <option value="GMT (UTC+0)">GMT (UTC+0)</option>
                <option value="CET (UTC+1)">CET (UTC+1)</option>
                <option value="IST (UTC+5:30)">IST (UTC+5:30)</option>
                <option value="JST (UTC+9)">JST (UTC+9)</option>
                <option value="AEST (UTC+10)">AEST (UTC+10)</option>
                <option value="NZST (UTC+12)">NZST (UTC+12)</option>
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Deadline
            </label>
            <DateTimePicker
              value={formData.meta.deadline}
              onChange={(value) => handleMetaChange('deadline', value)}
            />
          </div>

          {/* New & Edits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New
              </label>
              <input
                type="text"
                value={formData.meta.new}
                onChange={(e) => handleMetaChange('new', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="New information"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Edits
              </label>
              <input
                type="text"
                value={formData.meta.edits}
                onChange={(e) => handleMetaChange('edits', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Edit information"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 px-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md hover:shadow-lg transition-all duration-200"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ===================== ADD NEW TICKET MODAL ===================== */
const AddNewTicketModal = ({ onSave, onClose }) => {
  const [formData, setFormData] = useState({
    jobId: '',
    clientName: '',
    consultantName: '',
    clientEmail: '',
    subject: '',
    message: '',
    status: 'not_assigned',
    meta: {
      new: '',
      edits: '',
      timezone: '',
      deadline: '',
      toCheck: [],
      clientType: [],
      teamEst: '',
      comments: '',
      fileOutput: [],
      sharePointLink: ''
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMetaChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      meta: { ...prev.meta, [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.jobId.trim()) {
      alert('Job ID is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-100/80 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex justify-between items-center rounded-t-lg">
          <h2 className="text-xl font-bold text-white">Add New Ticket</h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Basic Info Section */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Job ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Job ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.jobId}
                  onChange={(e) => handleChange('jobId', e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Enter Job ID"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                >
                  {STATUSES.map(status => (
                    <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                  ))}
                </select>
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Client Name
                </label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => handleChange('clientName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Enter Client Name"
                />
              </div>

              {/* Consultant Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Consultant Name
                </label>
                <input
                  type="text"
                  value={formData.consultantName}
                  onChange={(e) => handleChange('consultantName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Enter Consultant Name"
                />
              </div>

              {/* Client Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Client Email
                </label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => handleChange('clientEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Enter Client Email"
                />
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={formData.meta.timezone}
                  onChange={(e) => handleMetaChange('timezone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                >
                  <option value="">Select Timezone</option>
                  <option value="EST (UTC-5)">EST (UTC-5)</option>
                  <option value="CST (UTC-6)">CST (UTC-6)</option>
                  <option value="MST (UTC-7)">MST (UTC-7)</option>
                  <option value="PST (UTC-8)">PST (UTC-8)</option>
                  <option value="GMT (UTC+0)">GMT (UTC+0)</option>
                  <option value="CET (UTC+1)">CET (UTC+1)</option>
                  <option value="IST (UTC+5:30)">IST (UTC+5:30)</option>
                  <option value="JST (UTC+9)">JST (UTC+9)</option>
                  <option value="AEST (UTC+10)">AEST (UTC+10)</option>
                  <option value="NZST (UTC+12)">NZST (UTC+12)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Subject & Message */}
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">Subject & Message</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => handleChange('subject', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Enter Subject"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => handleChange('message', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                  placeholder="Enter Message"
                />
              </div>
            </div>
          </div>

          {/* Optional Fields Toggle */}
          <div className="border-b border-gray-200 pb-4">
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showOptionalFields ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-semibold">Slides & Additional Information</span>
              <span className="text-xs text-gray-400 font-normal">(can be filled later)</span>
            </button>

            {showOptionalFields && (
              <div className="mt-4 space-y-4">
                {/* Slides Info */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-2">Slides Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        New
                      </label>
                      <input
                        type="text"
                        value={formData.meta.new}
                        onChange={(e) => handleMetaChange('new', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        placeholder="New slides count"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Edits
                      </label>
                      <input
                        type="text"
                        value={formData.meta.edits}
                        onChange={(e) => handleMetaChange('edits', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        placeholder="Edit slides count"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-2">Additional Information</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        SharePoint Link
                      </label>
                      <input
                        type="url"
                        value={formData.meta.sharePointLink}
                        onChange={(e) => handleMetaChange('sharePointLink', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        placeholder="Enter SharePoint Link"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Comments
                      </label>
                      <textarea
                        value={formData.meta.comments}
                        onChange={(e) => handleMetaChange('comments', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                        placeholder="Enter Comments"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-2.5 px-4 rounded-lg hover:from-green-700 hover:to-emerald-700 font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Ticket'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 px-4 rounded-lg hover:bg-gray-300 font-medium transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ===================== ADD TO EXISTING TICKET MODAL ===================== */
const AddToExistingTicketModal = ({ sourceTicket, allTickets, onClose, onMerge }) => {
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Extract client identifier from source ticket
  const sourceClientEmail = sourceTicket.clientEmail?.toLowerCase();
  const sourceClientName = sourceTicket.clientName?.toLowerCase();

  // Filter tickets: only same client, exclude source ticket, apply search
  const availableTickets = allTickets.filter(ticket => {
    // Exclude the source ticket itself
    if (ticket._id === sourceTicket._id) return false;

    // Only show tickets from the same client
    const ticketClientEmail = ticket.clientEmail?.toLowerCase();
    const ticketClientName = ticket.clientName?.toLowerCase();

    // Match by email (preferred) or client name
    const isSameClient =
      (sourceClientEmail && ticketClientEmail && sourceClientEmail === ticketClientEmail) ||
      (sourceClientName && ticketClientName && sourceClientName === ticketClientName);

    if (!isSameClient) return false;

    // Apply search filter
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    return (
      ticket.jobId?.toLowerCase().includes(search) ||
      ticket.consultantName?.toLowerCase().includes(search) ||
      ticket.subject?.toLowerCase().includes(search)
    );
  });

  const handleMerge = () => {
    if (!selectedTargetId) {
      alert('Please select a ticket to merge into');
      return;
    }
    onMerge(selectedTargetId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-green-50">
          <div>
            <h2 className="text-lg font-bold text-green-800">Add to Existing Ticket</h2>
            <p className="text-sm text-green-700 mt-1">
              Source: <span className="font-semibold">{sourceTicket.jobId}</span> - {sourceTicket.clientName}
            </p>
            <p className="text-xs text-green-600 mt-1">
              📌 Showing {availableTickets.length} ticket{availableTickets.length !== 1 ? 's' : ''} from <span className="font-semibold">{sourceTicket.clientName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b bg-gray-50">
          <input
            type="text"
            placeholder="Search by Job ID, Consultant, Subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Ticket List */}
        <div className="flex-1 overflow-y-auto p-4">
          {availableTickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-3">📭</div>
              <p className="font-medium text-gray-700">No matching tickets found</p>
              <p className="text-sm mt-2">
                {searchTerm
                  ? 'Try adjusting your search or clear the search field'
                  : `No other tickets found for client: ${sourceTicket.clientName}`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableTickets.map((ticket) => (
                <div
                  key={ticket._id}
                  onClick={() => setSelectedTargetId(ticket._id)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedTargetId === ticket._id
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-blue-600 text-sm">{ticket.jobId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          ticket.status === 'completed' ? 'bg-green-100 text-green-700' :
                          ticket.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          ticket.status === 'not_assigned' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {STATUS_LABEL[ticket.status] || ticket.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">
                        <strong>Client:</strong> {ticket.clientName || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <strong>Consultant:</strong> {ticket.consultantName || 'N/A'}
                      </p>
                      {ticket.subject && (
                        <p className="text-xs text-gray-600 mt-1 truncate">
                          <strong>Subject:</strong> {ticket.subject}
                        </p>
                      )}
                    </div>
                    {selectedTargetId === ticket._id && (
                      <div className="ml-3 text-green-600">
                        <Check size={24} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-600">
              This will merge all emails from <span className="font-semibold">{sourceTicket.jobId}</span> into the selected ticket
            </p>
            <p className="text-xs text-gray-500 mt-1">
              The source ticket will be deleted after merging
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md text-sm font-semibold hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={!selectedTargetId}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Merge Tickets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ===================== ACTION MENU ===================== */
const ActionMenu = ({ ticket, onDelete, onEdit, onUndo, onAddToExisting }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleDelete = (e) => {
    e.stopPropagation();
    console.log('🎯 Delete button clicked for ticket:', ticket._id);
    setOpen(false);
    onDelete(ticket._id);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setOpen(false);
    onEdit(ticket);
  };

  const handleUndo = (e) => {
    e.stopPropagation();
    console.log('↩️ Undo button clicked for ticket:', ticket._id);
    setOpen(false);
    onUndo(ticket._id);
  };

  const handleAddToExisting = (e) => {
    e.stopPropagation();
    console.log('➕ Add to existing ticket clicked for:', ticket._id);
    setOpen(false);
    onAddToExisting(ticket);
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 140 // Increased width for longer text
      });
    }
    setOpen(!open);
  };

  // Check if undo button should be shown (only for not_assigned status)
  const showUndo = ticket.status === 'not_assigned';

  return (
    <div className="relative" ref={menuRef}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="p-1 rounded hover:bg-gray-200 transition-colors"
        title="Actions"
      >
        <MoreVertical size={14} className="text-gray-600" />
      </button>
      {open && (
        <div
          className="fixed w-36 bg-white border border-gray-300 rounded-lg text-[11px] z-[9999]"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
          <button
            onClick={handleEdit}
            className="w-full text-left px-3 py-2 text-blue-600 hover:bg-blue-50 text-[11px] transition-colors flex items-center gap-2 border-b border-gray-200 rounded-t-lg font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
          <button
            onClick={handleAddToExisting}
            className="w-full text-left px-3 py-2 text-green-600 hover:bg-green-50 text-[11px] transition-colors flex items-center gap-2 border-b border-gray-200 font-medium"
          >
            <Plus size={14} className="text-green-600" />
            Add to Existing
          </button>

          <button
            onClick={handleDelete}
            className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 text-[11px] transition-colors flex items-center gap-2 rounded-b-lg font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

/* ===================== QC FEEDBACK VIEW MODAL ===================== */
const QCFeedbackViewModal = ({ ticket, onClose }) => {
  const qcFeedback = ticket?.qcFeedback || {};
  const hasQCFeedback = Object.keys(qcFeedback).length > 0;

  return (
    <div className="fixed inset-0 bg-gray-100/80 flex items-center justify-center z-[9999]">
      <div className="bg-white w-[700px] max-h-[85vh] rounded-lg shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="font-semibold text-lg">
            Job Details - <span className="font-bold">{ticket.jobId}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-xl font-bold p-1 hover:bg-white/20 rounded-full transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Job Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
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
                <span className="ml-2 text-gray-800">{ticket.consultantName || '-'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Team Lead:</span>
                <span className="ml-2 text-gray-800">
                  {ticket.assignedInfo?.teamLeads?.join(', ') || ticket.assignedInfo?.teamLead || '-'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">QC FEEDBACK</span>
            </h3>

            {hasQCFeedback ? (
              <div className="space-y-3">
                {qcFeedback.quality && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Quality</div>
                    <div className="text-sm text-gray-800">{qcFeedback.quality}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {qcFeedback.slideCount && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="text-xs font-semibold text-gray-600 mb-1">Slide Count</div>
                      <div className="text-sm text-gray-800">{qcFeedback.slideCount}</div>
                    </div>
                  )}

                  {qcFeedback.slideWithError && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="text-xs font-semibold text-gray-600 mb-1">Slide with Error</div>
                      <div className="text-sm text-gray-800">{qcFeedback.slideWithError}</div>
                    </div>
                  )}
                </div>

                {qcFeedback.content && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Content</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{qcFeedback.content}</div>
                  </div>
                )}

                {qcFeedback.instructionMissed && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Instruction Missed</div>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{qcFeedback.instructionMissed}</div>
                  </div>
                )}

                {qcFeedback.layout && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Layout</div>
                    <div className="text-sm text-gray-800">{qcFeedback.layout}</div>
                  </div>
                )}

                {qcFeedback.format && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Format</div>
                    <div className="text-sm text-gray-800">{qcFeedback.format}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {qcFeedback.formatTable && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="text-xs font-semibold text-gray-600 mb-1">Format - Table</div>
                      <div className="text-sm text-gray-800">{qcFeedback.formatTable}</div>
                    </div>
                  )}

                  {qcFeedback.formatChart && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <div className="text-xs font-semibold text-gray-600 mb-1">Format - Chart</div>
                      <div className="text-sm text-gray-800">{qcFeedback.formatChart}</div>
                    </div>
                  )}
                </div>

                {qcFeedback.globalCheck && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Global Check</div>
                    <div className="text-sm text-gray-800">{qcFeedback.globalCheck}</div>
                  </div>
                )}

                {qcFeedback.ftrAoq && (
                  <div className="bg-gray-50 p-3 rounded-md">
                    <div className="text-xs font-semibold text-gray-600 mb-1">FTR/AOQ</div>
                    <div className="text-sm text-gray-800">{qcFeedback.ftrAoq}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                <p className="text-sm">No QC feedback available for this job</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ===================== DEADLINE PICKER MODAL ===================== */
const DeadlinePickerModal = ({ ticket, onClose, onSave }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedHour, setSelectedHour] = useState('12');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedTimezone, setSelectedTimezone] = useState('IST (UTC+5:30)');

  useEffect(() => {
    // Initialize with current deadline if exists
    if (ticket.meta?.deadline) {
      const deadline = new Date(ticket.meta.deadline);
      const year = deadline.getFullYear();
      const month = String(deadline.getMonth() + 1).padStart(2, '0');
      const day = String(deadline.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
      setSelectedHour(String(deadline.getHours()).padStart(2, '0'));
      setSelectedMinute(String(deadline.getMinutes()).padStart(2, '0'));
      setSelectedTimezone(ticket.meta?.timezone || 'IST (UTC+5:30)');
    } else {
      // Default to today
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
    }
  }, [ticket]);

  const TIMEZONES = [
    "PST (UTC-8)", "MST (UTC-7)", "CST (UTC-6)", "EST (UTC-5)",
    "GMT (UTC+0)", "CET (UTC+1)", "EET (UTC+2)", "IST (UTC+5:30)",
    "CST (UTC+8)", "JST (UTC+9)", "AEST (UTC+10)", "NZST (UTC+12)"
  ];

  const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const MINUTES = ['00', '15', '30', '45'];

  const convertToIST = () => {
    if (!selectedDate || !selectedHour || !selectedMinute) return 'Select date and time';

    try {
      // Parse timezone offset
      const tzMatch = selectedTimezone.match(/UTC([+-]\d+(?::\d+)?)\)/);
      if (!tzMatch) return 'Invalid timezone';

      const offset = tzMatch[1];
      const [offsetHours, offsetMinutes = 0] = offset.split(':').map(Number);
      const totalOffsetMinutes = offsetHours * 60 + (offsetHours < 0 ? -offsetMinutes : offsetMinutes);

      // Create date in selected timezone
      const dateTimeStr = `${selectedDate}T${selectedHour}:${selectedMinute}:00`;
      const selectedDateTime = new Date(dateTimeStr);

      // Convert to UTC
      const utcTime = new Date(selectedDateTime.getTime() - totalOffsetMinutes * 60000);

      // Convert to IST (UTC+5:30)
      const istTime = new Date(utcTime.getTime() + (5.5 * 60 * 60000));

      // Format IST time
      const istDate = istTime.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const istTimeStr = istTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      return `${istDate}, ${istTimeStr} IST`;
    } catch (error) {
      console.error('Error converting time:', error);
      return 'Invalid date/time';
    }
  };

  const handleConfirm = () => {
    if (!selectedDate || !selectedHour || !selectedMinute) {
      alert('Please select date, hour, and minute');
      return;
    }

    const deadlineStr = `${selectedDate}T${selectedHour}:${selectedMinute}:00`;
    onSave({
      deadline: deadlineStr,
      timezone: selectedTimezone
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-100/80 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Set Deadline - {ticket.jobId}</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Date Picker */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">📅 Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">🕐 Hour (24h)</label>
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {HOURS.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">⏱️ Minute</label>
              <select
                value={selectedMinute}
                onChange={(e) => setSelectedMinute(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {MINUTES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">🌍 Timezone</label>
            <select
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          {/* IST Preview */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-blue-800 mb-1">IST Time Preview:</div>
            <div className="text-sm font-bold text-blue-900">{convertToIST()}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Confirm Deadline
          </button>
        </div>
      </div>
    </div>
  );
};

/* ===================== MAIN DASHBOARD ===================== */
const TICKETS_CACHE_KEY = 'coordinatorDashboardTicketsCache';
const TEAM_CACHE_KEY = 'coordinatorDashboardTeamCache';

const CoordinatorDashboardHome = () => {
  // ⚡ INSTANT LOAD: Initialize from localStorage cache
  const [tickets, setTickets] = useState(() => {
    try {
      const cached = localStorage.getItem(TICKETS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        console.log(`⚡ INSTANT: Loaded ${parsed.length} cached tickets`);
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load cached tickets:', e);
    }
    return [];
  });

  // Ref to always have access to the latest tickets state (avoids stale closure issues)
  const ticketsRef = useRef(tickets);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  const [isInitialLoading, setIsInitialLoading] = useState(true); // Shows skeleton on first load only
  const [isEmailSyncing, setIsEmailSyncing] = useState(false); // Separate indicator for email sync
  const [toast, setToast] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedTicketEmails, setSelectedTicketEmails] = useState([]);
  const [loadingEmailsMap, setLoadingEmailsMap] = useState({}); // per-ticket loading
  const [teamMap, setTeamMap] = useState({});
  const [allEmps, setAllEmps] = useState([]);
  const [teamMemberColors, setTeamMemberColors] = useState({}); // Store member name -> color mapping
  const [saveStatusMap, setSaveStatusMap] = useState({}); // Track save status per ticket
  const [pendingSavesMap, setPendingSavesMap] = useState({}); // Track pending save data
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [showQCViewModal, setShowQCViewModal] = useState(false);
  const [viewTicket, setViewTicket] = useState(null);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);
  const [deadlineTicket, setDeadlineTicket] = useState(null);

  // Gmail email viewer state
  const [showGmailViewer, setShowGmailViewer] = useState(false);
  const [gmailContent, setGmailContent] = useState(null);
  const [gmailError, setGmailError] = useState(null);
  const [gmailErrorTicket, setGmailErrorTicket] = useState(null);
  const [loadingGmail, setLoadingGmail] = useState(false);
  const [emailCacheMap, setEmailCacheMap] = useState({});

  // Add to Existing Ticket state
  const [showAddToExistingModal, setShowAddToExistingModal] = useState(false);
  const [sourceTicket, setSourceTicket] = useState(null);
  const [loadingExistingTickets, setLoadingExistingTickets] = useState(false);

  // Add New Ticket state
  const [showAddNewTicketModal, setShowAddNewTicketModal] = useState(false);

  // Auto-refresh state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  // Column configuration version - increment this to reset user preferences to new defaults
  const COLUMN_CONFIG_VERSION = 2; // v2: Updated default visible columns

  // Column order and visibility state
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      // Check if we need to reset due to version change
      const savedVersion = localStorage.getItem('coordinatorDashboardColumnVersion');
      if (savedVersion !== String(COLUMN_CONFIG_VERSION)) {
        // Version changed - clear old preferences and use new defaults
        localStorage.removeItem('coordinatorDashboardColumnOrder');
        localStorage.removeItem('coordinatorDashboardColumns');
        localStorage.setItem('coordinatorDashboardColumnVersion', String(COLUMN_CONFIG_VERSION));
        console.log('📋 Column preferences reset to new defaults (v' + COLUMN_CONFIG_VERSION + ')');
        return DEFAULT_COLUMNS;
      }

      const savedOrder = localStorage.getItem('coordinatorDashboardColumnOrder');
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder);
        // Merge with DEFAULT_COLUMNS to include any new columns
        const savedIds = parsed.map(col => col.id);
        const newColumns = DEFAULT_COLUMNS.filter(col => !savedIds.includes(col.id));

        // Insert new columns at their default positions
        if (newColumns.length > 0) {
          const merged = [...parsed];
          newColumns.forEach(newCol => {
            const defaultIndex = DEFAULT_COLUMNS.findIndex(c => c.id === newCol.id);
            // Find the best position to insert
            let insertIndex = merged.length;
            for (let i = defaultIndex + 1; i < DEFAULT_COLUMNS.length; i++) {
              const nextColId = DEFAULT_COLUMNS[i].id;
              const existingIndex = merged.findIndex(c => c.id === nextColId);
              if (existingIndex !== -1) {
                insertIndex = existingIndex;
                break;
              }
            }
            merged.splice(insertIndex, 0, newCol);
          });
          return merged;
        }
        return parsed;
      }
    } catch (error) {
      console.error('Failed to load column order from localStorage:', error);
    }
    return DEFAULT_COLUMNS;
  });

  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      // If version was just reset in columnOrder initialization, use defaults
      const savedVersion = localStorage.getItem('coordinatorDashboardColumnVersion');
      if (savedVersion !== String(COLUMN_CONFIG_VERSION)) {
        return DEFAULT_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultVisible }), {});
      }

      const saved = localStorage.getItem('coordinatorDashboardColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with DEFAULT_COLUMNS to include any new columns
        const merged = { ...parsed };
        DEFAULT_COLUMNS.forEach(col => {
          if (!(col.id in merged)) {
            merged[col.id] = col.defaultVisible;
          }
        });
        return merged;
      }
    } catch (error) {
      console.error('Failed to load column visibility from localStorage:', error);
    }
    // Default visibility based on column config
    return DEFAULT_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultVisible }), {});
  });

  // Collapsed status groups state
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('coordinatorDashboardCollapsedGroups');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load collapsed groups from localStorage:', error);
    }
    // Default: all groups expanded
    return {};
  });

  // Save column preferences to localStorage with error handling
  useEffect(() => {
    try {
      localStorage.setItem('coordinatorDashboardColumns', JSON.stringify(visibleColumns));
    } catch (error) {
      console.error('Failed to save column visibility to localStorage:', error);
    }
  }, [visibleColumns]);

  useEffect(() => {
    try {
      localStorage.setItem('coordinatorDashboardColumnOrder', JSON.stringify(columnOrder));
    } catch (error) {
      console.error('Failed to save column order to localStorage:', error);
    }
  }, [columnOrder]);

  useEffect(() => {
    try {
      localStorage.setItem('coordinatorDashboardCollapsedGroups', JSON.stringify(collapsedGroups));
    } catch (error) {
      console.error('Failed to save collapsed groups to localStorage:', error);
    }
  }, [collapsedGroups]);

  const toggleColumn = (columnId) => {
    setVisibleColumns(prev => ({ ...prev, [columnId]: !prev[columnId] }));
  };

  const reorderColumns = (newOrder) => {
    setColumnOrder(newOrder);
  };

  const resetColumns = () => {
    setColumnOrder(DEFAULT_COLUMNS);
    const defaultVisibility = DEFAULT_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultVisible }), {});
    setVisibleColumns(defaultVisibility);
  };

  const toggleGroupCollapse = (status) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  // Calculate grid column count based on visible columns
  const visibleColumnCount = columnOrder.filter(col => visibleColumns[col.id]).length;

  // Generate grid template columns with custom widths
  const getGridTemplateColumns = () => {
    const columnWidths = {
      'jobId': '70px',        // Fixed width for Job ID
      'new': '40px',           // New slides count
      'edits': '40px',         // Edits count
      'client': '90px',       // Client name
      'clientType': '100px',   // Client types (multiple badges)
      'consultant': '100px',   // Consultant name
      'toCheck': '80px',      // To Check (multiple names)
      'teamLead': '120px',     // Team Lead (multiple with colors)
      'teamMember': '120px',   // Team Members (multiple with colors + owner badge)
      'status': '100px',       // Status dropdown
      'estimate': '110px',     // Estimate (hours + minutes)
      'timezone': '100px',     // Timezone
      'deadline': '80px',     // Deadline date/time
      'istTime': '80px',      // IST Time
      'ticketTime': '120px',   // Ticket Time
      'assignTime': '120px',   // Assign Job Time
      'startTime': '120px',    // Start Job Time
      'fileOutput': '120px',   // File Output types
      'proofRead': '60px',    // Proof read dropdown
      'mail': '40px',          // Mail icon
      'action': '40px',        // Action menu
      // Default width for other columns
      'default': '100px'
    };

    return columnOrder
      .filter(col => visibleColumns[col.id])
      .map(col => columnWidths[col.id] || columnWidths.default)
      .join(' ');
  };

  /* ======== SYNC EMAILS FROM GMAIL ======== */
  const syncEmails = async (showFeedback = false) => {
    // ⚡ NON-BLOCKING: Show indicator but don't block UI
    setIsEmailSyncing(true);
    try {
      console.log('📧 Syncing starred emails from Gmail...');
      const startTime = Date.now();
      const res = await emailAPI.syncEmails();
      const duration = Date.now() - startTime;
      const ticketsCreated = res.data?.ticketsCreated || 0;
      console.log(`✅ Email sync completed in ${duration}ms:`, res.data?.emailsFetched || 0, 'emails,', ticketsCreated, 'new tickets');

      // Show toast if new tickets were created OR if manual sync requested
      if (ticketsCreated > 0) {
        showToast(`${ticketsCreated} new starred email(s) synced from Gmail`, 'success');
        // ⚡ BACKGROUND REFRESH: Update ticket list without page reload
        fetchTickets(false, false);
      } else if (showFeedback) {
        showToast('No new starred emails found', 'info');
      }
    } catch (error) {
      console.error('❌ Error syncing emails:', error);
      // Show error only for manual sync
      if (showFeedback) {
        showToast('Failed to sync emails from Gmail', 'error');
      }
    } finally {
      setIsEmailSyncing(false);
    }
  };

  /* ======== FETCH TICKETS ======== */
  const fetchTickets = async (showSyncIndicator = false, isInitial = false) => {
    try {
      if (showSyncIndicator) {
        setIsSyncing(true);
      }

      const startTime = performance.now();
      console.log('📊 === CLIENT PROFILING START ===');
      console.log('⏱️ Starting ticket fetch...');

      console.time('1️⃣ API Request');
      const res = await ticketAPI.getAllTickets();
      console.timeEnd('1️⃣ API Request');

      const fetchedTickets = res.data?.tickets || [];
      console.log(`✅ Received ${fetchedTickets.length} tickets from API`);

      console.time('2️⃣ Setting state');
      setTickets(fetchedTickets);
      console.timeEnd('2️⃣ Setting state');

      // ⚡ CACHE: Save to localStorage for instant load on refresh
      try {
        localStorage.setItem(TICKETS_CACHE_KEY, JSON.stringify(fetchedTickets));
        console.log(`💾 Cached ${fetchedTickets.length} tickets to localStorage`);
      } catch (e) {
        console.warn('Failed to cache tickets:', e);
      }

      const totalTime = performance.now() - startTime;
      console.log(`⚡ TOTAL TIME: ${totalTime.toFixed(0)}ms`);
      console.log('📊 === CLIENT PROFILING END ===\n');

      if (totalTime > 2000) {
        console.warn(`⚠️ SLOW! Took ${(totalTime / 1000).toFixed(1)}s to load tickets`);
      }

      // Update sync time
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('❌ Error loading tickets:', error);
      console.error('Error details:', error.response?.data || error.message);
      showToast("Error loading tickets");
    } finally {
      if (showSyncIndicator) {
        setIsSyncing(false);
      }
      // Mark initial loading as complete
      if (isInitial) {
        setIsInitialLoading(false);
      }
    }
  };

  /* ======== FETCH TEAM MEMBERS ======== */
  const fetchTeamMembers = async () => {
    try {
      const res = await teamMemberAPI.getGroupedTeamMembers();
      const { teamMap: fetchedTeamMap, teamMembers } = res.data;
      setTeamMap(fetchedTeamMap || {});
      setAllEmps(Object.values(fetchedTeamMap || {}).flat());

      // Create a mapping of member name -> teamName (color)
      if (teamMembers && Array.isArray(teamMembers)) {
        const colorMap = {};
        teamMembers.forEach(member => {
          if (member.name && member.teamName) {
            colorMap[member.name] = member.teamName;
          }
        });
        setTeamMemberColors(colorMap);
      }
    } catch (error) {
      console.error("Error loading team members:", error);
      showToast("Error loading team members");
    }
  };

  // ⚡ INSTANT PAGE LOAD: Show cached data immediately, fetch fresh data in background
  useEffect(() => {
    // Check if we have cached data - if yes, page is already usable!
    const hasCachedData = tickets.length > 0;

    if (hasCachedData) {
      console.log('⚡ INSTANT: Page ready with cached data, fetching fresh data in background...');
      setIsInitialLoading(false); // Page is immediately usable
    }

    // Fetch fresh tickets and team members (fast, from DB)
    fetchTickets(false, !hasCachedData); // Only mark as initial if no cache
    fetchTeamMembers();

    // ⚡ EMAIL SYNC: Start in background after a brief delay (doesn't block UI)
    // The UI is already interactive at this point
    const emailSyncTimeout = setTimeout(() => {
      syncEmails();
    }, 1000); // 1 second delay to ensure UI is fully rendered

    // 🔄 AUTO-REFRESH: Poll every 60 seconds
    const refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing tickets...');
      fetchTickets(false, false);
    }, 60000);

    // ⚡ FAST EMAIL SYNC: Check for new starred emails every 30 seconds
    const emailSyncInterval = setInterval(() => {
      console.log('📧 Auto-syncing starred emails...');
      syncEmails();
    }, 30000);

    // Cleanup intervals on component unmount
    return () => {
      clearTimeout(emailSyncTimeout);
      clearInterval(refreshInterval);
      clearInterval(emailSyncInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg, type = 'info') => {
    // type can be: 'success', 'error', 'warning', 'info'
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), type === 'success' ? 5000 : 8000);
  };

  const getStatusCount = (status) => tickets.filter(t => t.status === status).length;

  // Update save status for a ticket
  const updateSaveStatus = (ticketId, status) => {
    setSaveStatusMap(prev => ({ ...prev, [ticketId]: status }));

    // Auto-clear saved status after 2 seconds
    if (status === SAVE_STATUS.SAVED) {
      setTimeout(() => {
        setSaveStatusMap(prev => {
          const newMap = { ...prev };
          if (newMap[ticketId] === SAVE_STATUS.SAVED) {
            newMap[ticketId] = SAVE_STATUS.IDLE;
          }
          return newMap;
        });
      }, 2000);
    }
  };

  // Improved updateTicketField with proper error handling and save status
  const updateTicketField = async (ticketId, patch, retryCount = 0) => {
    const maxRetries = 3;

    console.log(`💾 Saving ticket ${ticketId}:`, patch);

    // Optimistically update UI
    setTickets(prev => prev.map(t => t._id === ticketId ? { ...t, ...patch } : t));

    // Set saving status
    updateSaveStatus(ticketId, SAVE_STATUS.SAVING);

    // Store pending save data for retry
    setPendingSavesMap(prev => ({ ...prev, [ticketId]: patch }));

    try {
      const response = await ticketAPI.updateTicket(ticketId, patch);
      console.log(`✅ Ticket ${ticketId} saved successfully:`, response.data);

      // Clear pending save
      setPendingSavesMap(prev => {
        const newMap = { ...prev };
        delete newMap[ticketId];
        return newMap;
      });

      // Set saved status
      updateSaveStatus(ticketId, SAVE_STATUS.SAVED);
    } catch (error) {
      console.error(`❌ Error saving ticket ${ticketId}:`, error);
      console.error('Error response:', error.response?.data);
      console.error('Patch that failed:', patch);

      // Retry logic
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying save for ticket ${ticketId}, attempt ${retryCount + 1}/${maxRetries}`);
        setTimeout(() => {
          updateTicketField(ticketId, patch, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        // Max retries reached - show error
        updateSaveStatus(ticketId, SAVE_STATUS.ERROR);
        showToast("Failed to save changes. Click retry to try again.");
        console.error(`❌ Max retries reached for ticket ${ticketId}. Save failed.`);

        // Rollback optimistic update
        setTickets(prev => prev.map(t => {
          if (t._id === ticketId) {
            // Revert to previous state by removing the patch
            const revertedTicket = { ...t };
            Object.keys(patch).forEach(key => {
              if (key === 'meta' && patch.meta) {
                // For meta updates, we need to be more careful
                // This is a simplified rollback - in production you'd want to track the previous value
                console.warn('⚠️ Unable to fully rollback meta changes');
              }
            });
            return revertedTicket;
          }
          return t;
        }));
      }
    }
  };

  // Manual retry function for failed saves
  const retrySave = async (ticketId) => {
    const pendingPatch = pendingSavesMap[ticketId];
    if (pendingPatch) {
      await updateTicketField(ticketId, pendingPatch);
    }
  };

  // Debounced update for text inputs (500ms delay)
  const debouncedUpdateTicketField = useDebounce((ticketId, patch) => {
    updateTicketField(ticketId, patch);
  }, 500);

  // Immediate update handler for inputs that shows "saving" status immediately
  const handleInputChange = (ticketId, patch, value, setter) => {
    // Update UI immediately for responsive feel
    setter(value);

    // Show saving status immediately
    updateSaveStatus(ticketId, SAVE_STATUS.SAVING);

    // Debounce the actual save
    debouncedUpdateTicketField(ticketId, patch);
  };

  // Parse estimate string like "2h 30m" or "2:30" to { hours, minutes }
  const parseEstimate = (estStr) => {
    if (!estStr) return { hours: 0, minutes: '00' };

    // Try parsing "2h 30m" format
    const hhmm = estStr.match(/(\d+)h\s*(\d+)m/);
    if (hhmm) return { hours: parseInt(hhmm[1]), minutes: hhmm[2].padStart(2, '0') };

    // Try parsing "2:30" format
    const colon = estStr.match(/(\d+):(\d+)/);
    if (colon) return { hours: parseInt(colon[1]), minutes: colon[2].padStart(2, '0') };

    // Try parsing just hours "2"
    const hoursOnly = estStr.match(/^(\d+)$/);
    if (hoursOnly) return { hours: parseInt(hoursOnly[1]), minutes: '00' };

    return { hours: 0, minutes: '00' };
  };

  // Format hours and minutes to "2h 30m"
  const formatEstimate = (hours, minutes) => {
    if (hours === 0 && minutes === '00') return '';
    return `${hours}h ${minutes}m`;
  };

  const handleEstimateChange = async (ticket, hours, minutes) => {
    const formattedEst = formatEstimate(hours, minutes);
    await updateTicketField(ticket._id, {
      meta: { ...ticket.meta, teamEst: formattedEst }
    });
  };

  const deleteTicket = async (ticketId) => {
    if (!ticketId) {
      console.error('❌ Cannot delete ticket: ticketId is undefined');
      showToast("Error: Invalid ticket ID");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this ticket? This action cannot be undone.")) {
      console.log('🚫 Ticket deletion cancelled by user');
      return;
    }

    try {
      console.log('🗑️ Deleting ticket:', ticketId);
      const response = await ticketAPI.deleteTicket(ticketId);
      console.log('✅ Delete response:', response.data);

      setTickets(prev => prev.filter(t => t._id !== ticketId));
      showToast("Ticket deleted successfully", 'success');
    } catch (error) {
      console.error('❌ Error deleting ticket:', error);
      console.error('Error details:', error.response?.data || error.message);
      showToast(`Failed to delete ticket: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const undoTicket = async (ticketId) => {
    if (!ticketId) {
      console.error('❌ Cannot undo ticket: ticketId is undefined');
      showToast("Error: Invalid ticket ID");
      return;
    }

    if (!window.confirm("Undo ticket creation? This will restore the email(s) back to the Mail page.")) {
      console.log('🚫 Ticket undo cancelled by user');
      return;
    }

    try {
      console.log('↩️ Undoing ticket:', ticketId);
      const response = await ticketAPI.undoTicket(ticketId);
      console.log('✅ Undo response:', response.data);

      setTickets(prev => prev.filter(t => t._id !== ticketId));
      showToast("Ticket undone successfully. Email(s) restored to Mail page.", 'success');
    } catch (error) {
      console.error('❌ Error undoing ticket:', error);
      console.error('Error details:', error.response?.data || error.message);
      showToast(`Failed to undo ticket: ${error.response?.data?.message || error.message}`, 'error');
    }
  };

  const handleEditTicket = (ticket) => {
    setEditingTicket(ticket);
    setShowEditModal(true);
  };

  const handleAddToExistingTicket = (ticket) => {
    console.log('➕ Opening Add to Existing modal for ticket:', ticket.jobId);
    setSourceTicket(ticket);
    setShowAddToExistingModal(true);
  };

  const handleMergeTickets = async (targetTicketId) => {
    if (!sourceTicket) {
      showToast('Error: No source ticket selected');
      return;
    }

    try {
      console.log(`🔀 Merging ticket ${sourceTicket.jobId} into ${targetTicketId}`);

      // Call API to merge tickets
      const response = await fetch(`http://localhost:5000/api/tickets/${targetTicketId}/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sourceTicketId: sourceTicket._id,
          sourceJobId: sourceTicket.jobId
        })
      });

      const data = await response.json();

      if (response.ok) {
        showToast(`✅ Successfully merged ${sourceTicket.jobId} into target ticket`);
        setShowAddToExistingModal(false);
        setSourceTicket(null);

        // Refresh tickets to show updated data
        fetchTickets();
      } else {
        const errorMessage = data.message || 'Failed to merge tickets';
        if (data.sourceClient && data.targetClient) {
          showToast(`❌ Cannot merge: Different clients (${data.sourceClient} ≠ ${data.targetClient})`);
        } else {
          showToast(`❌ ${errorMessage}`);
        }
      }
    } catch (error) {
      console.error('Error merging tickets:', error);
      showToast('❌ Error merging tickets');
    }
  };

  const handleSaveEdit = async (updatedData) => {
    try {
      await ticketAPI.updateTicket(editingTicket._id, updatedData);
      setTickets(prev => prev.map(t => t._id === editingTicket._id ? { ...t, ...updatedData } : t));
      setShowEditModal(false);
      setEditingTicket(null);
      showToast("Ticket updated successfully");
      fetchTickets(); // Refresh to get latest data
    } catch (error) {
      console.error('Error updating ticket:', error);
      showToast("Failed to update ticket");
    }
  };

  const handleViewGmailEmail = useCallback(async (ticket) => {
    if (!ticket.messageId) {
      showToast("No email associated with this ticket");
      console.warn("⚠️ Ticket has no messageId:", ticket);
      return;
    }

    // Check if email content is already cached
    if (emailCacheMap[ticket._id]) {
      console.log(`⚡ INSTANT: Using cached Gmail content for ticket ${ticket.jobId}`);
      setGmailContent(emailCacheMap[ticket._id]);
      setGmailError(null);
      setShowGmailViewer(true);
      return;
    }

    // Set loading states
    setLoadingEmailsMap(prev => ({ ...prev, [ticket._id]: true }));
    setLoadingGmail(true);
    setGmailContent(null);
    setGmailError(null);
    setShowGmailViewer(true); // Show modal immediately with loading state

    try {
      console.log(`📧 Fetching Gmail content for ticket ${ticket.jobId}, messageId: ${ticket.messageId}`);
      const startTime = performance.now();
      const response = await ticketAPI.getEmailContent(ticket._id);
      const duration = performance.now() - startTime;

      console.log(`✅ Gmail content loaded in ${duration.toFixed(0)}ms:`, response.data);

      const emailContent = response.data.emailContent;

      if (!emailContent || (!emailContent.html && !emailContent.text)) {
        throw new Error('Email content is empty');
      }

      setGmailContent(emailContent);
      setGmailError(null);
      setLoadingGmail(false);

      // Cache the email content for fast future access
      setEmailCacheMap(prev => ({ ...prev, [ticket._id]: emailContent }));

      console.log(`✅ Gmail content cached:`, {
        hasHtml: !!emailContent?.html,
        hasText: !!emailContent?.text,
        attachmentsCount: emailContent?.attachments?.length || 0,
        duration: `${duration.toFixed(0)}ms`
      });
    } catch (error) {
      console.error('❌ Error fetching Gmail content:', error);
      console.error('Error response:', error.response?.data);

      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setGmailError(errorMessage);
      setLoadingGmail(false);

      // Store error ticket for retry
      setGmailErrorTicket(ticket);

      showToast("Failed to load email: " + errorMessage);
    } finally {
      setLoadingEmailsMap(prev => ({ ...prev, [ticket._id]: false }));
    }
  }, [emailCacheMap]);

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditingTicket(null);
  };

  // Handle creating a new ticket
  const handleCreateNewTicket = async (formData) => {
    try {
      // Prepare ticket data with required fields
      const ticketData = {
        jobId: formData.jobId,
        clientName: formData.clientName || 'Manual Entry',
        consultantName: formData.consultantName || 'Manual Entry',
        clientEmail: formData.clientEmail || 'manual@entry.com',
        subject: formData.subject || `Manual Ticket - ${formData.jobId}`,
        message: formData.message || '',
        status: formData.status || 'not_assigned',
        meta: formData.meta,
        createdBy: 'Coordinator (Manual)'
      };

      const response = await ticketAPI.createTicket(ticketData);

      if (response.data && response.data.ticket) {
        setTickets(prev => [response.data.ticket, ...prev]);
        showToast(`Ticket ${formData.jobId} created successfully`);
        setShowAddNewTicketModal(false);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      showToast(`Failed to create ticket: ${error.response?.data?.message || error.message}`, 'error');
      throw error; // Re-throw to keep modal open
    }
  };

  const handleSaveDeadline = async (data) => {
    if (!deadlineTicket) return;

    try {
      const updatedMeta = {
        ...deadlineTicket.meta,
        deadline: data.deadline,
        timezone: data.timezone
      };

      await ticketAPI.updateTicket(deadlineTicket._id, { meta: updatedMeta });
      setTickets(prev => prev.map(t =>
        t._id === deadlineTicket._id
          ? { ...t, meta: updatedMeta }
          : t
      ));
      showToast("Deadline updated successfully");
    } catch (error) {
      console.error('Error updating deadline:', error);
      showToast("Failed to update deadline");
    }
  };

  const handleAddTeamMember = async (ticket, empName) => {
    if (!empName) return;

    // Get current team members or initialize as empty array
    const currentMembers = ticket.assignedInfo?.teamMembers || [];

    // Add new member if not already assigned
    if (currentMembers.includes(empName)) {
      showToast(`${empName} is already assigned`);
      return;
    }

    const newMembers = [...currentMembers, empName];

    // Get team leads for all members
    const teamLeads = newMembers.map(member => {
      return Object.entries(teamMap).find(([_, emps]) => emps.includes(member))?.[0];
    }).filter(Boolean);
    const uniqueTeamLeads = [...new Set(teamLeads)];

    const patch = {
      assignedInfo: {
        empName: newMembers[0], // Keep first member for backwards compatibility
        teamLead: uniqueTeamLeads[0] || '', // Keep first team lead for backwards compatibility
        teamMembers: newMembers, // New array field for multiple members
        teamLeads: uniqueTeamLeads // Array of unique team leads
      },
      status: ticket.status
    };

    console.log(`👤 Adding team member ${empName} to ticket ${ticket._id}:`, patch);

    // Optimistically update UI
    setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, ...patch } : t));

    // Show saving status
    updateSaveStatus(ticket._id, SAVE_STATUS.SAVING);

    try {
      const response = await ticketAPI.assignTicket(ticket._id, patch);
      console.log(`✅ Team member ${empName} added successfully:`, response.data);
      updateSaveStatus(ticket._id, SAVE_STATUS.SAVED);
      showToast(`Added ${empName} to the team`, 'success');

      // If ticket is already in "assigned" status, send email ONLY to the newly added member
      if (ticket.status === 'assigned') {
        console.log(`📧 Sending assignment email to newly added member: ${empName}`);
        try {
          const emailResponse = await ticketAPI.sendAssignmentEmail(ticket._id, empName);
          const attachmentCount = emailResponse.data?.attachmentCount || 0;
          showToast(`Email sent to ${empName}${attachmentCount > 0 ? ` with ${attachmentCount} attachment(s)` : ''}`, 'success');
        } catch (emailError) {
          console.error(`❌ Error sending email to ${empName}:`, emailError);
          showToast(`Failed to send email to ${empName}: ${emailError.response?.data?.message || emailError.message}`, 'error');
        }
      }
    } catch (error) {
      console.error(`❌ Error adding team member ${empName}:`, error);
      console.error('Error response:', error.response?.data);
      updateSaveStatus(ticket._id, SAVE_STATUS.ERROR);
      showToast(`Failed to add ${empName}`, 'error');
      // Rollback
      setTickets(prev => prev.map(t => t._id === ticket._id ? ticket : t));
    }
  };

  const handleRemoveTeamMember = async (ticket, empName) => {
    if (!empName) return;

    const currentMembers = ticket.assignedInfo?.teamMembers || [];
    const newMembers = currentMembers.filter(member => member !== empName);

    let patch;
    if (newMembers.length === 0) {
      // If removing last member, clear assignment info
      patch = {
        assignedInfo: {
          empName: '',
          teamLead: '',
          teamMembers: [],
          teamLeads: []
        },
        status: 'not_assigned'
      };
    } else {
      // Update with remaining members
      const teamLeads = newMembers.map(member => {
        return Object.entries(teamMap).find(([_, emps]) => emps.includes(member))?.[0];
      }).filter(Boolean);
      const uniqueTeamLeads = [...new Set(teamLeads)];

      patch = {
        assignedInfo: {
          empName: newMembers[0],
          teamLead: uniqueTeamLeads[0] || '',
          teamMembers: newMembers,
          teamLeads: uniqueTeamLeads
        },
        status: ticket.status
      };
    }

    // Optimistically update UI
    setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, ...patch } : t));

    // Show saving status
    updateSaveStatus(ticket._id, SAVE_STATUS.SAVING);

    try {
      await ticketAPI.assignTicket(ticket._id, patch);
      updateSaveStatus(ticket._id, SAVE_STATUS.SAVED);
      showToast(`Removed ${empName}${newMembers.length === 0 ? ' - no members assigned' : ' from the team'}`);
    } catch (error) {
      console.error('Error removing team member:', error);
      updateSaveStatus(ticket._id, SAVE_STATUS.ERROR);
      showToast(`Failed to remove ${empName}`, 'error');
      // Rollback
      setTickets(prev => prev.map(t => t._id === ticket._id ? ticket : t));
    }
  };

  const handleSetOwner = async (ticket, memberName) => {
    // Find the team lead for this owner from teamMap
    let ownerTeamLead = null;
    if (memberName) {
      ownerTeamLead = Object.entries(teamMap).find(([_, emps]) => emps.includes(memberName))?.[0];
    }

    // Get current team leads
    const currentTeamLeads = ticket.assignedInfo?.teamLeads || [];

    // Update team leads: add owner's team lead if not already present
    let newTeamLeads = [...currentTeamLeads];
    if (memberName && ownerTeamLead && !newTeamLeads.includes(ownerTeamLead)) {
      newTeamLeads.push(ownerTeamLead);
    }

    // Preserve existing assignedInfo and update owner + team leads
    const patch = {
      assignedInfo: {
        ...ticket.assignedInfo,
        owner: memberName,
        teamLead: newTeamLeads[0] || '', // Keep first for backwards compatibility
        teamLeads: newTeamLeads
      }
    };

    console.log(`👑 Setting owner to ${memberName || 'none'} for ticket ${ticket._id}${ownerTeamLead ? ` (Team Lead: ${ownerTeamLead})` : ''}`);

    // Optimistically update UI
    setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, ...patch } : t));

    // Show saving status
    updateSaveStatus(ticket._id, SAVE_STATUS.SAVING);

    try {
      await ticketAPI.assignTicket(ticket._id, patch);
      updateSaveStatus(ticket._id, SAVE_STATUS.SAVED);
      const message = memberName
        ? `${memberName} set as Owner${ownerTeamLead ? ` (Team Lead: ${ownerTeamLead} added)` : ''}`
        : 'Owner cleared';
      showToast(message);
    } catch (error) {
      console.error('Error setting owner:', error);
      updateSaveStatus(ticket._id, SAVE_STATUS.ERROR);
      showToast('Failed to set owner');
      // Rollback
      setTickets(prev => prev.map(t => t._id === ticket._id ? ticket : t));
    }
  };

  const handleAddTeamLead = async (ticket, leadName) => {
    if (!leadName) return;

    // Get current team leads or initialize as empty array
    const currentLeads = ticket.assignedInfo?.teamLeads || [];

    // Check if already assigned
    if (currentLeads.includes(leadName)) {
      showToast(`${leadName} is already a Team Lead`);
      return;
    }

    // Add to team leads array
    const newLeads = [...currentLeads, leadName];

    const patch = {
      assignedInfo: {
        ...ticket.assignedInfo,
        teamLead: newLeads[0], // Keep first for backwards compatibility
        teamLeads: newLeads
      }
    };

    console.log(`👔 Adding ${leadName} as team lead for ticket ${ticket._id}`);

    // Optimistically update UI
    setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, ...patch } : t));

    // Show saving status
    updateSaveStatus(ticket._id, SAVE_STATUS.SAVING);

    try {
      await ticketAPI.assignTicket(ticket._id, patch);
      updateSaveStatus(ticket._id, SAVE_STATUS.SAVED);
      showToast(`${leadName} added as Team Lead`);
    } catch (error) {
      console.error('Error adding team lead:', error);
      updateSaveStatus(ticket._id, SAVE_STATUS.ERROR);
      showToast('Failed to add team lead');
      // Rollback
      setTickets(prev => prev.map(t => t._id === ticket._id ? ticket : t));
    }
  };

  const handleRemoveTeamLead = async (ticket, leadName) => {
    if (!leadName) return;

    // Get current team leads
    const currentLeads = ticket.assignedInfo?.teamLeads || [];

    // Remove from team leads array
    const newLeads = currentLeads.filter(lead => lead !== leadName);

    const patch = {
      assignedInfo: {
        ...ticket.assignedInfo,
        teamLead: newLeads[0] || '', // Keep first for backwards compatibility
        teamLeads: newLeads
      }
    };

    console.log(`👔 Removing ${leadName} as team lead for ticket ${ticket._id}`);

    // Optimistically update UI
    setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, ...patch } : t));

    // Show saving status
    updateSaveStatus(ticket._id, SAVE_STATUS.SAVING);

    try {
      await ticketAPI.assignTicket(ticket._id, patch);
      updateSaveStatus(ticket._id, SAVE_STATUS.SAVED);
      showToast(`${leadName} removed as Team Lead`);
    } catch (error) {
      console.error('Error removing team lead:', error);
      updateSaveStatus(ticket._id, SAVE_STATUS.ERROR);
      showToast('Failed to remove team lead');
      // Rollback
      setTickets(prev => prev.map(t => t._id === ticket._id ? ticket : t));
    }
  };

  const handleAddClientType = async (ticket, type) => {
    if (!type) return;
    const currentTypes = Array.isArray(ticket.meta?.clientType)
      ? ticket.meta.clientType
      : ticket.meta?.clientType ? [ticket.meta.clientType] : [];

    if (currentTypes.includes(type)) {
      showToast(`${type} is already selected`);
      return;
    }

    const newTypes = [...currentTypes, type];
    console.log(`🏷️ Adding client type "${type}" to ticket ${ticket._id}. New types:`, newTypes);

    await updateTicketField(ticket._id, {
      meta: { ...ticket.meta, clientType: newTypes }
    });

    showToast(`Added client type: ${type}`);
  };

  const handleRemoveClientType = async (ticket, type) => {
    if (!type) return;
    const currentTypes = Array.isArray(ticket.meta?.clientType)
      ? ticket.meta.clientType
      : ticket.meta?.clientType ? [ticket.meta.clientType] : [];

    const newTypes = currentTypes.filter(t => t !== type);
    console.log(`🏷️ Removing client type "${type}" from ticket ${ticket._id}. Remaining:`, newTypes);

    await updateTicketField(ticket._id, {
      meta: { ...ticket.meta, clientType: newTypes.length > 0 ? newTypes : [] }
    });

    showToast(`Removed client type: ${type}`);
  };

  const handleAddToCheck = async (ticket, name) => {
    if (!name) return;
    const currentNames = Array.isArray(ticket.meta?.toCheck)
      ? ticket.meta.toCheck
      : ticket.meta?.toCheck ? [ticket.meta.toCheck] : [];

    if (currentNames.includes(name)) {
      showToast(`${name} is already selected`);
      return;
    }

    const newNames = [...currentNames, name];
    console.log(`✅ Adding to check "${name}" to ticket ${ticket._id}. New names:`, newNames);

    await updateTicketField(ticket._id, {
      meta: { ...ticket.meta, toCheck: newNames }
    });

    showToast(`Added to check: ${name}`);
  };

  const handleRemoveToCheck = async (ticket, name) => {
    if (!name) return;
    const currentNames = Array.isArray(ticket.meta?.toCheck)
      ? ticket.meta.toCheck
      : ticket.meta?.toCheck ? [ticket.meta.toCheck] : [];

    const newNames = currentNames.filter(n => n !== name);
    console.log(`✅ Removing to check "${name}" from ticket ${ticket._id}. Remaining:`, newNames);

    await updateTicketField(ticket._id, {
      meta: { ...ticket.meta, toCheck: newNames.length > 0 ? newNames : [] }
    });

    showToast(`Removed to check: ${name}`);
  };

  const getStatusOptions = (ticket) => {
    const index = STATUSES.indexOf(ticket.status);
    return STATUSES.map((status, i) => ({
      value: status,
      label: STATUS_LABEL[status],
      disabled: i > index + 1 || (!ticket.assignedInfo?.empName && status !== "not_assigned")
    }));
  };

  /* ======== STATUS CHANGE HANDLER ======== */
  const handleStatusChange = async (ticket, newStatus) => {
    const oldStatus = ticket.status;

    // Update the ticket status with proper save tracking
    await updateTicketField(ticket._id, { status: newStatus });

    // If status changed to "assigned", send emails to all team members
    if (newStatus === 'assigned' && oldStatus !== 'assigned') {
      // IMPORTANT: Use ticketsRef to get the LATEST ticket data (avoids stale closure issue)
      // The 'ticket' parameter might be from an older render and not have the updated teamMembers
      const latestTicket = ticketsRef.current.find(t => t._id === ticket._id);
      const teamMembers = latestTicket?.assignedInfo?.teamMembers || [];

      console.log('📧 Status changed to assigned, checking team members:', {
        ticketId: ticket._id,
        staleTeamMembers: ticket.assignedInfo?.teamMembers || [],
        latestTeamMembers: teamMembers
      });

      if (teamMembers.length > 0) {
        // Send emails to all team members
        let emailsSent = 0;
        let totalAttachments = 0;

        // Show that we're sending emails
        updateSaveStatus(ticket._id, SAVE_STATUS.SAVING);

        for (const member of teamMembers) {
          try {
            const emailResponse = await ticketAPI.sendAssignmentEmail(ticket._id, member);
            emailsSent++;
            totalAttachments += emailResponse.data?.attachmentCount || 0;
          } catch (error) {
            console.error(`Error sending email to ${member}:`, error);
          }
        }

        if (emailsSent > 0) {
          updateSaveStatus(ticket._id, SAVE_STATUS.SAVED);
          showToast(`Emails sent to ${emailsSent} team member(s) with ${totalAttachments} total attachment(s)`);
        } else {
          updateSaveStatus(ticket._id, SAVE_STATUS.ERROR);
          showToast("Failed to send assignment emails");
        }
      } else {
        showToast("Status changed to Assigned, but no team members to notify");
      }
    }
  };

  /* ======== EMAIL HANDLER ======== */
  const handleOpenEmailModal = async (ticket) => {
    if (!ticket.jobId) {
      showToast("No Job ID found");
      return;
    }

    setSelectedJobId(ticket.jobId);
    setSelectedTicketId(ticket._id);
    setLoadingEmailsMap(prev => ({ ...prev, [ticket._id]: true }));

    let emails = [];
    if (ticket.emails && Array.isArray(ticket.emails) && ticket.emails.length > 0) emails = ticket.emails;
    else if (ticket.emailData && Array.isArray(ticket.emailData) && ticket.emailData.length > 0) emails = ticket.emailData;
    else if (ticket.mail && Array.isArray(ticket.mail) && ticket.mail.length > 0) emails = ticket.mail;
    else if (ticket.meta?.emails && Array.isArray(ticket.meta.emails) && ticket.meta.emails.length > 0) emails = ticket.meta.emails;
    else {
      try {
        const res = await ticketAPI.getEmailsByJobId(ticket.jobId);
        emails = res.data?.emails || res.data || [];
        if (emails.length > 0) {
          setTickets(prev => prev.map(t => t._id === ticket._id ? { ...t, emails } : t));
        }
      } catch (error) {
        console.error("Email API error:", error);
        showToast("Error fetching emails");
      }
    }

    setSelectedTicketEmails(emails);
    setShowEmailModal(true);
    setLoadingEmailsMap(prev => ({ ...prev, [ticket._id]: false }));

    if (emails.length > 0) showToast(`${emails.length} email(s) loaded`);
    else showToast("No emails found for this Job ID");
  };

  const closeEmailModal = () => {
    setShowEmailModal(false);
    setSelectedJobId(null);
    setSelectedTicketId(null);
    setSelectedTicketEmails([]);
  };

  const handleRemoveEmailFromTicket = async (emailId) => {
    // Remove email from the displayed list immediately for better UX
    setSelectedTicketEmails(prev => prev.filter(email => email._id !== emailId));

    // Refresh the ticket data from backend
    try {
      const response = await ticketAPI.getAllTickets();
      setTickets(response.data.tickets);
      showToast("Email removed and ticket updated");
    } catch (error) {
      console.error("Error refreshing tickets:", error);
      showToast("Email removed but failed to refresh ticket list");
    }
  };

  // Render column content based on column ID
  const renderColumnContent = (columnId, ticket) => {
    switch (columnId) {
      case 'jobId':
        return (
          <div className="flex items-center gap-1.5">
            <span
              className="font-semibold text-blue-600 hover:underline cursor-pointer text-[11px] truncate block"
              onClick={() => {
                setViewTicket(ticket);
                setShowQCViewModal(true);
              }}
              title="Click to view job details and QC feedback"
            >
              {ticket.jobId || "-"}
            </span>
            {ticket.mergeCount > 0 && (
              <span
                className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded-full flex-shrink-0"
                title={`${ticket.mergeCount} ticket${ticket.mergeCount > 1 ? 's' : ''} merged into this one`}
              >
                +{ticket.mergeCount}
              </span>
            )}
          </div>
        );

      case 'client':
        return <span className="text-[11px] text-gray-800 font-medium truncate block" title={ticket.clientName}>{ticket.clientName || "-"}</span>;

      case 'clientType':
        const clientTypes = Array.isArray(ticket.meta?.clientType)
          ? ticket.meta.clientType
          : ticket.meta?.clientType ? [ticket.meta.clientType] : [];
        return (
          <MultiSelectClientType
            selectedTypes={clientTypes}
            allTypes={CLIENT_TYPES}
            onAddType={(type) => handleAddClientType(ticket, type)}
            onRemoveType={(type) => handleRemoveClientType(ticket, type)}
          />
        );

      case 'consultant':
        return <span className="text-[11px] text-gray-700 truncate block" title={ticket.consultantName}>{ticket.consultantName || "-"}</span>;

      case 'teamLead':
        const allTeamLeads = Object.keys(teamMap); // Get all team lead names from teamMap
        return (
          <MultiSelectTeamLead
            selectedLeads={ticket.assignedInfo?.teamLeads || []}
            allLeads={allTeamLeads}
            onAddLead={(lead) => handleAddTeamLead(ticket, lead)}
            onRemoveLead={(lead) => handleRemoveTeamLead(ticket, lead)}
            teamLeadColors={teamMemberColors}
          />
        );

      case 'teamMember':
        return (
          <MultiSelectTeamMember
            selectedMembers={ticket.assignedInfo?.teamMembers || []}
            allMembers={allEmps}
            onAddMember={(member) => handleAddTeamMember(ticket, member)}
            onRemoveMember={(member) => handleRemoveTeamMember(ticket, member)}
            teamMap={teamMap}
            teamMemberColors={teamMemberColors}
            owner={ticket.assignedInfo?.owner || null}
            onSetOwner={(member) => handleSetOwner(ticket, member)}
          />
        );

      case 'status':
        return (
          <ModernDropdown
            value={ticket.status}
            onChange={(val) => handleStatusChange(ticket, val)}
            options={getStatusOptions(ticket)}
            colorClass={STATUS_COLOR[ticket.status]}
            size="small"
          />
        );

      case 'estimate':
        return (
          <div className="flex gap-0.5 items-center">
            <ModernDropdown
              value={parseEstimate(ticket.meta?.teamEst).hours}
              onChange={(val) => handleEstimateChange(ticket, parseInt(val), parseEstimate(ticket.meta?.teamEst).minutes)}
              options={HOURS_OPTIONS.map(h => ({ value: h, label: `${h}h` }))}
              width="w-[50px]"
              size="small"
            />
            <ModernDropdown
              value={parseEstimate(ticket.meta?.teamEst).minutes}
              onChange={(val) => handleEstimateChange(ticket, parseEstimate(ticket.meta?.teamEst).hours, val)}
              options={MINUTES_OPTIONS.map(m => ({ value: m, label: `${m}m` }))}
              width="w-[60px]"
              size="small"
            />
          </div>
        );

      case 'timezone':
        return (
          <ModernDropdown
            value={ticket.meta?.timezone || ""}
            onChange={(val) => updateTicketField(ticket._id, { meta: { ...ticket.meta, timezone: val } })}
            options={[{ value: "", label: "-" }, ...TIMEZONES.map(tz => ({ value: tz, label: tz }))]}
            placeholder="-"
            searchable={true}
            size="small"
          />
        );

      case 'deadline':
        const deadlineValue = ticket.meta?.deadline;
        let dateDisplay = '-';
        let timeDisplay = '';
        let timezoneDisplay = '';

        if (deadlineValue) {
          const date = new Date(deadlineValue);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          dateDisplay = `${day}-${month}-${year}`;

          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          timeDisplay = `${hours}:${minutes}`;

          timezoneDisplay = ticket.meta?.timezone || 'IST (UTC+5:30)';
        }

        return (
          <button
            onClick={() => {
              setDeadlineTicket(ticket);
              setShowDeadlineModal(true);
            }}
            className="w-full px-1 py-1 text-[10px] rounded-sm bg-white border border-transparent hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 transition-all text-left"
            title="Click to set deadline"
          >
            <div className="flex flex-col gap-0.5">
              <div className={`font-semibold ${deadlineValue ? 'text-gray-800' : 'text-gray-400'}`}>
                {dateDisplay}
              </div>
              {deadlineValue && (
                <>
                  <div className="text-blue-600 text-[9px]">
                    {timezoneDisplay}
                  </div>
                  <div className="text-gray-600 text-[10px] font-medium">
                    {timeDisplay}
                  </div>
                </>
              )}
            </div>
          </button>
        );

      case 'istTime':
        const istDisplay = formatDeadlineDisplay(ticket.meta?.deadline, ticket.meta?.timezone);
        if (istDisplay === '-') {
          return <span className="text-[11px] text-gray-400">-</span>;
        }

        // Split by comma to separate date/day from time
        const [datePart, timePart] = istDisplay.split(', ');

        return (
          <div className="flex flex-col gap-0.5 py-0.5">
            <div className="text-[10px] font-semibold text-gray-800">
              {datePart}
            </div>
            <div className="text-[10px] text-gray-600">
              {timePart}
            </div>
          </div>
        );

      case 'ticketTime':
        return <span className="text-[11px] text-gray-700 truncate block">{ticket.createdAt ? formatDateTime(new Date(ticket.createdAt)) : "-"}</span>;

      case 'assignTime':
        return <span className="text-[11px] text-gray-700 truncate block">{ticket.assignedAt ? formatDateTime(new Date(ticket.assignedAt)) : "-"}</span>;

      case 'startTime':
        return <span className="text-[11px] text-gray-700 truncate block">{ticket.startedAt ? formatDateTime(new Date(ticket.startedAt)) : "-"}</span>;

      case 'new':
        return (
          <input
            className={`${inputClass} truncate`}
            type="text"
            value={ticket.meta?.new || ""}
            onChange={e => {
              // Update local state immediately for responsive UI
              const newValue = e.target.value;
              setTickets(prev => prev.map(t =>
                t._id === ticket._id
                  ? { ...t, meta: { ...t.meta, new: newValue } }
                  : t
              ));

              // Show saving status and debounce the actual save
              updateSaveStatus(ticket._id, SAVE_STATUS.SAVING);
              debouncedUpdateTicketField(ticket._id, { meta: { ...ticket.meta, new: newValue } });
            }}
            placeholder="-"
          />
        );

      case 'edits':
        return (
          <input
            className={`${inputClass} truncate`}
            type="text"
            value={ticket.meta?.edits || ""}
            onChange={e => {
              // Update local state immediately for responsive UI
              const newValue = e.target.value;
              setTickets(prev => prev.map(t =>
                t._id === ticket._id
                  ? { ...t, meta: { ...t.meta, edits: newValue } }
                  : t
              ));

              // Show saving status and debounce the actual save
              updateSaveStatus(ticket._id, SAVE_STATUS.SAVING);
              debouncedUpdateTicketField(ticket._id, { meta: { ...ticket.meta, edits: newValue } });
            }}
            placeholder="-"
          />
        );

      case 'fileOutput':
        return (
          <MultiSelectDropdown
            selectedValues={Array.isArray(ticket.meta?.fileOutput) ? ticket.meta.fileOutput : (ticket.meta?.fileOutput ? [ticket.meta.fileOutput] : [])}
            onChange={(values) => updateTicketField(ticket._id, { meta: { ...ticket.meta, fileOutput: values } })}
            options={FILE_OUTPUT_OPTIONS}
            placeholder="-"
            size="small"
          />
        );

      case 'proofRead':
        return (
          <ModernDropdown
            value={ticket.meta?.proofRead || ""}
            onChange={(val) => updateTicketField(ticket._id, { meta: { ...ticket.meta, proofRead: val } })}
            options={[
              { value: "", label: "-" },
              { value: "Yes", label: "Yes" },
              { value: "No", label: "No" }
            ]}
            placeholder="-"
            size="small"
          />
        );

      case 'toCheck':
        const toCheckNames = Array.isArray(ticket.meta?.toCheck)
          ? ticket.meta.toCheck
          : ticket.meta?.toCheck ? [ticket.meta.toCheck] : [];
        return (
          <MultiSelectToCheck
            selectedNames={toCheckNames}
            allNames={TO_CHECK_OPTIONS}
            onAddName={(name) => handleAddToCheck(ticket, name)}
            onRemoveName={(name) => handleRemoveToCheck(ticket, name)}
          />
        );

      case 'mail':
        // Show Gmail viewer for tickets with messageId
        if (ticket.messageId) {
          const isLoadingEmail = loadingEmailsMap[ticket._id];
          return (
            <div
              className="flex items-center justify-center cursor-pointer hover:bg-blue-50 rounded transition"
              onClick={() => !isLoadingEmail && handleViewGmailEmail(ticket)}
              title="View original Gmail email"
            >
              {isLoadingEmail ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-blue-600 border-t-transparent"></div>
              ) : (
                <Mail size={14} className="text-blue-600" />
              )}
            </div>
          );
        }

        // For old tickets without messageId, show nothing
        return (
          <div className="flex items-center justify-center">
            <span className="text-[10px] text-gray-400">-</span>
          </div>
        );

      case 'action':
        return <ActionMenu ticket={ticket} onDelete={deleteTicket} onEdit={handleEditTicket} onUndo={undoTicket} onAddToExisting={handleAddToExistingTicket} />;

      default:
        return null;
    }
  };

  // ⚡ LOADING: Show spinner overlay on first load without cached data
  if (isInitialLoading && tickets.length === 0) {
    return (
      <div className="flex flex-col h-screen p-2 bg-white text-[13px]">
        <style>{hideScrollbarStyles}</style>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent mb-3"></div>
            <p className="text-gray-600 text-sm">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen p-2 bg-white text-[13px]">
      <style>{hideScrollbarStyles}</style>

      {/* Column Manager and Sync Indicator */}
      <div className="mb-3 flex justify-between items-center flex-shrink-0">
        {/* Sync Indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4">
            {/* Ticket Sync Status */}
            <div className="flex items-center gap-2">
              {isSyncing && (
                <div className="flex items-center gap-2 text-blue-600 animate-pulse">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-xs font-medium">Syncing tickets...</span>
                </div>
              )}
              {!isSyncing && lastSyncTime && (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs">
                    Last synced: {new Date(lastSyncTime).toLocaleTimeString()}
                  </span>
                </div>
              )}
              {!isSyncing && !lastSyncTime && (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span className="text-xs">Auto-refresh enabled</span>
                </div>
              )}
            </div>

            {/* Email Sync Indicator - Shows when Gmail sync is happening */}
            {isEmailSyncing && (
              <div className="flex items-center gap-2 text-purple-600 animate-pulse border-l border-gray-300 pl-4">
                <Mail size={14} className="animate-bounce" />
                <span className="text-xs font-medium">Checking Gmail...</span>
              </div>
            )}
          </div>
          <button
            onClick={() => fetchTickets(true)}
            disabled={isSyncing}
            className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded disabled:opacity-50 transition-colors"
            title="Refresh tickets"
          >
            {isSyncing ? '⟳' : '↻'} Refresh
          </button>
        </div>

        <div className="flex items-center gap-2">
          <ColumnManager
            columnOrder={columnOrder}
            visibleColumns={visibleColumns}
            onReorderColumns={reorderColumns}
            onToggleColumn={toggleColumn}
            onResetColumns={resetColumns}
          />

          {/* New Ticket Button */}
          <button
            onClick={() => setShowAddNewTicketModal(true)}
            className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors flex items-center gap-1"
            title="Add new ticket manually"
          >
            <Plus size={14} />
            New Ticket
          </button>
        </div>
      </div>
  {/* Scrollable Content Section */}
  <div className="flex-grow overflow-y-auto page-scroll">
    <div className="space-y-3">
      {STATUSES.map(status => {
        // Filter tickets by status and sort by creation date (newest first)
        const statusTickets = tickets
          .filter(t => t.status === status)
          .sort((a, b) => {
            // Sort by createdAt in descending order (newest first)
            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return dateB - dateA;
          });
        const count = statusTickets.length;
        const isCollapsed = collapsedGroups[status];

        return (
          <div key={status} className="bg-white border border-gray-200 rounded overflow-hidden">
            {/* Group Header */}
            <div
              className="px-3 py-2 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100"
              onClick={() => toggleGroupCollapse(status)}
            >
              <div className="flex items-center gap-2">
                <button className="p-0.5">
                  {isCollapsed ? (
                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                <div className={`${STATUS_BADGE_BG[status]} text-white px-3 py-1 rounded-md font-medium text-[12px]`}>
                  {STATUS_LABEL[status]} <span className="ml-1 text-[11px] font-semibold">({count})</span>
                </div>
                {!isCollapsed && count > 0 && (
                  <span className="text-[10px] text-gray-500 ml-1">
                    📅 Newest first
                  </span>
                )}
              </div>
              {isCollapsed && count > 0 && (
                <span className="text-[10px] text-gray-500">
                  {count} hidden
                </span>
              )}
            </div>

          {/* TICKETS - Only show when not collapsed */}
          {!isCollapsed && count > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    {columnOrder.map(column => (
                      visibleColumns[column.id] && (
                        <th key={column.id} className="px-3 py-1.5 text-left text-[12px] font-bold text-gray-700">
                          {column.label}
                        </th>
                      )
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
              {statusTickets.map(ticket => (
                <tr key={ticket._id} className="hover:bg-gray-50 border-b border-gray-100 relative group">
                  {columnOrder.map(column => (
                    visibleColumns[column.id] && (
                      <td key={column.id} className={`px-3 py-1.5 whitespace-nowrap ${saveStatusMap[ticket._id] === SAVE_STATUS.ERROR ? 'bg-red-50' : ''}`}>
                        {renderColumnContent(column.id, ticket)}
                      </td>
                    )
                  ))}
                  {/* Save Status Indicator - Positioned on the right */}
                  <td className="px-3 py-1.5 relative">
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <SaveStatusIndicator
                        status={saveStatusMap[ticket._id] || SAVE_STATUS.IDLE}
                        onRetry={() => retrySave(ticket._id)}
                      />
                    </div>
                    {/* Always show error status even without hover */}
                    {saveStatusMap[ticket._id] === SAVE_STATUS.ERROR && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <SaveStatusIndicator
                          status={SAVE_STATUS.ERROR}
                          onRetry={() => retrySave(ticket._id)}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        );
      })}
      </div>
    </div>

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <EmailModal
          jobId={selectedJobId}
          ticketId={selectedTicketId}
          emails={selectedTicketEmails}
          onClose={closeEmailModal}
          onRemoveEmail={handleRemoveEmailFromTicket}
        />
      )}

      {/* QC FEEDBACK VIEW MODAL */}
      {showQCViewModal && viewTicket && (
        <QCFeedbackViewModal
          ticket={viewTicket}
          onClose={() => {
            setShowQCViewModal(false);
            setViewTicket(null);
          }}
        />
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingTicket && (
        <EditTicketModal
          ticket={editingTicket}
          onSave={handleSaveEdit}
          onClose={handleCloseEditModal}
        />
      )}

      {/* ADD NEW TICKET MODAL */}
      {showAddNewTicketModal && (
        <AddNewTicketModal
          onSave={handleCreateNewTicket}
          onClose={() => setShowAddNewTicketModal(false)}
        />
      )}

      {/* ADD TO EXISTING TICKET MODAL */}
      {showAddToExistingModal && sourceTicket && (
        <AddToExistingTicketModal
          sourceTicket={sourceTicket}
          allTickets={tickets}
          onClose={() => {
            setShowAddToExistingModal(false);
            setSourceTicket(null);
          }}
          onMerge={handleMergeTickets}
        />
      )}

      {/* DEADLINE PICKER MODAL */}
      {showDeadlineModal && deadlineTicket && (
        <DeadlinePickerModal
          ticket={deadlineTicket}
          onSave={handleSaveDeadline}
          onClose={() => {
            setShowDeadlineModal(false);
            setDeadlineTicket(null);
          }}
        />
      )}

      {/* GMAIL VIEWER MODAL */}
      {showGmailViewer && (
        <GmailViewerModal
          emailContent={gmailContent}
          loading={loadingGmail}
          error={gmailError}
          onClose={() => {
            setShowGmailViewer(false);
            setGmailContent(null);
            setGmailError(null);
            setGmailErrorTicket(null);
          }}
          onRetry={() => {
            if (gmailErrorTicket) {
              console.log('🔄 Retrying email fetch for ticket:', gmailErrorTicket.jobId);
              setGmailError(null);
              handleViewGmailEmail(gmailErrorTicket);
            }
          }}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-6 py-4 rounded-lg shadow-xl text-[14px] font-medium flex items-center gap-3 z-50 ${
          toast.type === 'success' ? 'bg-green-600 text-white' :
          toast.type === 'error' ? 'bg-red-600 text-white' :
          toast.type === 'warning' ? 'bg-yellow-500 text-gray-900' :
          'bg-gray-900 text-white'
        }`}>
          {toast.type === 'success' && <span className="text-xl">✓</span>}
          {toast.type === 'error' && <span className="text-xl">✕</span>}
          {toast.type === 'warning' && <span className="text-xl">⚠</span>}
          {toast.type === 'info' && <span className="text-xl">ℹ</span>}
          {toast.message || toast}
        </div>
      )}
    </div>
  );
};

export default CoordinatorDashboardHome;  
