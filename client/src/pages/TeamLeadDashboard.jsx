import { useEffect, useState, useRef } from "react";
import { Mail, Settings, GripVertical, X, ChevronDown, ChevronRight, Check, AlertCircle, Clock, LogOut, Eye, Plus } from "lucide-react";
import { ticketAPI } from "../utils/api";
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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
const DEFAULT_COLUMNS = [
  { id: 'jobId', label: 'Job ID', defaultVisible: true },
  { id: 'client', label: 'Client', defaultVisible: true },
  { id: 'clientType', label: 'Client Type', defaultVisible: true },
  { id: 'consultant', label: 'Consultant', defaultVisible: true },
  { id: 'toCheck', label: 'To Check', defaultVisible: true },
  { id: 'teamLead', label: 'TL', defaultVisible: true },
  { id: 'teamMember', label: 'Team Member', defaultVisible: true },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'estimate', label: 'Estimate Time', defaultVisible: true },
  { id: 'timezone', label: 'Time Zone', defaultVisible: true },
  { id: 'deadline', label: 'Deadline', defaultVisible: true },
  { id: 'istTime', label: 'IST Time', defaultVisible: true },
  { id: 'ticketTime', label: 'Ticket Time', defaultVisible: true },
  { id: 'assignTime', label: 'Assign Job Time', defaultVisible: true },
  { id: 'startTime', label: 'Start Job Time', defaultVisible: true },
  { id: 'new', label: 'New', defaultVisible: true },
  { id: 'edits', label: 'Edits', defaultVisible: true },
  { id: 'fileOutput', label: 'File Output', defaultVisible: true },
  { id: 'proofRead', label: 'Proof read', defaultVisible: true },
  { id: 'mail', label: 'Mail', defaultVisible: true },
  { id: 'action', label: 'Action', defaultVisible: true }
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

/* ===================== STATUS CONFIGS ===================== */
const STATUSES = ["assigned","in_process","rf_qc","qcd","file_received","sent","on_hold","tbc","cancelled"];
const STATUS_LABEL = {
  not_assigned: "Not Assigned",
  assigned: "Assigned",
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
  in_process: "bg-blue-600",
  rf_qc: "bg-purple-600",
  qcd: "bg-green-600",
  file_received: "bg-orange-600",
  sent: "bg-teal-600",
  on_hold: "bg-gray-600",
  tbc: "bg-amber-600",
  cancelled: "bg-rose-600"
};

const CLIENT_TYPES = ["New Client","New Contact","Double Check","Non Standard","Level 1","Level 2","Level 3","Level 4","Basic Template","Premium Template","Signature Template"];

const HOURS_OPTIONS = Array.from({ length: 1000 }, (_, i) => i); // 0-999
const MINUTES_OPTIONS = ['00', '15', '30', '45'];

/* ===================== INPUT & SELECT STYLES ===================== */
const inputClass = "w-full px-0.5 py-0.5 text-[11px] rounded-sm bg-white focus:outline-none h-[20px] clean-input";
const selectClass = "w-full px-0.5 py-0.5 text-[11px] rounded-sm bg-white focus:outline-none h-[20px] clean-dropdown hide-scrollbar";

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
                  <div className="cursor-grab active:cursor-grabbing text-gray-400">
                    <GripVertical size={14} />
                  </div>
                  <input
                    type="checkbox"
                    checked={visibleColumns[column.id]}
                    onChange={() => onToggleColumn(column.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-3.5 h-3.5 text-gray-600 border-gray-300 rounded cursor-pointer"
                  />
                  <span className={`flex-1 text-sm select-none ${
                    visibleColumns[column.id] ? 'text-gray-800' : 'text-gray-500'
                  }`}>
                    {column.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

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

/* ===================== MODERN DROPDOWN COMPONENT ===================== */
const ModernDropdown = ({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  width = "w-full",
  colorClass = "",
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
  };

  const heightClass = size === "small" ? "h-[20px]" : "h-[24px]";
  const textSize = size === "small" ? "text-[11px]" : "text-[12px]";
  const paddingClass = size === "small" ? "px-1.5 py-0.5" : "px-2 py-1";

  return (
    <div className={`relative ${width}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${width} ${heightClass} ${paddingClass} ${textSize} bg-white border border-transparent rounded hover:border-gray-200 hover:bg-gray-50 transition-all text-left flex items-center justify-between ${colorClass} font-medium focus:outline-none focus:border-blue-300`}
      >
        <span className="truncate">{displayValue}</span>
        <ChevronDown size={12} className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="fixed mt-1 min-w-[150px] bg-white border border-gray-200 rounded-lg z-[9999] overflow-hidden shadow-lg"
             style={{
               top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY,
               left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX,
               width: dropdownRef.current?.offsetWidth || 'auto'
             }}>
          <div className="max-h-[200px] overflow-y-auto">
            {options.map((option, index) => {
              const optValue = typeof option === 'object' ? option.value : option;
              const optLabel = typeof option === 'object' ? option.label : option;
              const isSelected = optValue === value;

              return (
                <button
                  key={index}
                  onClick={() => handleSelect(option)}
                  className={`w-full px-3 py-1.5 text-[11px] text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'hover:bg-blue-50 text-gray-700'
                  }`}
                >
                  {optLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}
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

/* ===================== EMAIL MODAL ===================== */
const EmailModal = ({ jobId, emails, onClose }) => {
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleDownloadAttachment = async (emailId, attachmentId, filename) => {
    try {
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
    } catch (error) {
      console.error('Error downloading attachment:', error);
      alert('Failed to download attachment');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-[900px] max-h-[85vh] rounded-lg shadow-xl p-4 overflow-y-auto text-[13px]">
        <div className="flex justify-between items-center border-b border-gray-300 pb-2 mb-3">
          <h2 className="font-semibold text-lg text-gray-800">
            📧 Emails for Job ID: <span className="text-blue-600 font-bold">{jobId}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-red-500 hover:text-red-700 text-xl font-bold p-1 hover:bg-red-50 rounded-full transition-all"
          >
            ✕
          </button>
        </div>

        {emails.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-[13px]">No emails found for this job ID</p>
          </div>
        ) : (
          <div className="space-y-3">
            {emails.map((mail, i) => (
              <div key={i} className="border border-gray-200 rounded p-4 bg-white hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center mb-1">
                      <span className="font-bold text-sm text-gray-700">From:</span>
                      <span className="ml-2 font-medium text-blue-600">{mail.from || 'N/A'}</span>
                    </div>
                    <div className="flex items-center mb-1">
                      <span className="font-bold text-sm text-gray-700">To:</span>
                      <span className="ml-2 font-medium">{mail.to || 'N/A'}</span>
                    </div>
                    <div className="flex items-center mb-1">
                      <span className="font-bold text-sm text-gray-700">Subject:</span>
                      <span className="ml-2 font-semibold text-gray-900">{mail.subject || 'No Subject'}</span>
                    </div>
                    {mail.date && (
                      <div className="flex items-center">
                        <span className="font-bold text-sm text-gray-700">Date:</span>
                        <span className="ml-2 text-xs text-gray-600">{new Date(mail.date).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {mail.attachments && mail.attachments.length > 0 && (
                  <div className="mb-3 bg-white p-2 rounded border border-gray-200">
                    <p className="text-xs font-bold text-gray-700 mb-2">📎 Attachments ({mail.attachments.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {mail.attachments.map((attachment, attIdx) => (
                        <button
                          key={attIdx}
                          onClick={() => handleDownloadAttachment(mail._id, attIdx, attachment.filename)}
                          className="px-3 py-1.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-md border border-blue-300 transition-colors flex items-center gap-1"
                        >
                          <span>📄</span>
                          <span className="max-w-[200px] truncate">{attachment.filename}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-700 bg-white p-3 rounded border mt-2 max-h-96 overflow-y-auto">
                  {mail.bodyHtml && mail.bodyHtml.trim() !== '' ? (
                    <div
                      className="email-content"
                      dangerouslySetInnerHTML={{ __html: mail.bodyHtml }}
                      style={{ wordWrap: 'break-word', overflowWrap: 'break-word', lineHeight: '1.6' }}
                    />
                  ) : mail.body && mail.body.trim() !== '' ? (
                    <div className="whitespace-pre-wrap font-sans leading-relaxed">{mail.body}</div>
                  ) : (
                    <div className="text-center py-4 text-gray-400 italic">No email content available</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
  const hasQCFeedback = Object.keys(qcFeedback).length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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

/* ===================== QC FEEDBACK MODAL ===================== */
const QCFeedbackModal = ({ ticket, onClose, onSubmit }) => {
  const [qcFeedback, setQCFeedback] = useState({
    quality: '',
    slideCount: '',
    slideWithError: '',
    content: '',
    instructionMissed: '',
    layout: '',
    format: '',
    formatTable: '',
    formatChart: '',
    globalCheck: '',
    ftrAoq: ''
  });

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Calculate Quality % and FTR/AOQ automatically
  // Logic: "Yes" = Error exists (bad), "No" = No error (good)
  const calculateQualityMetrics = () => {
    const yesNoFields = ['content', 'instructionMissed', 'layout', 'format', 'formatTable', 'formatChart', 'globalCheck'];

    // Count "No" answers (No = no error = good)
    const noCount = yesNoFields.filter(field => qcFeedback[field] === 'No').length;
    const totalAnswered = yesNoFields.filter(field => qcFeedback[field] !== '').length;

    // If any field is "Yes" (has error), quality drops
    const hasAnyError = yesNoFields.some(field => qcFeedback[field] === 'Yes');

    // Calculate quality percentage: 100% only if all answered are "No" (no errors)
    let qualityPercent = 0;
    if (totalAnswered > 0) {
      qualityPercent = hasAnyError ? 0 : Math.round((noCount / totalAnswered) * 100);
    }

    // FTR/AOQ logic: "No" if any error exists (any "Yes"), otherwise "Yes"
    let ftrAoq = '';
    if (qcFeedback.content === 'Yes') {
      // Content error = FTR immediately becomes "No"
      ftrAoq = 'No';
    } else if (hasAnyError) {
      // Any other error = FTR is "No"
      ftrAoq = 'No';
    } else if (totalAnswered === yesNoFields.length && noCount === yesNoFields.length) {
      // All answered and all are "No" (no errors) = FTR is "Yes"
      ftrAoq = 'Yes';
    } else if (totalAnswered > 0 && !hasAnyError) {
      // Some answered, none have errors yet
      ftrAoq = 'Pending';
    }

    return { quality: `${qualityPercent}%`, ftrAoq };
  };

  const handleSubmit = () => {
    // Validate slideWithError is not greater than slideCount
    if (qcFeedback.slideCount && qcFeedback.slideWithError) {
      const slideCount = parseInt(qcFeedback.slideCount);
      const slideWithError = parseInt(qcFeedback.slideWithError);

      if (slideWithError > slideCount) {
        alert('Slide with Error cannot be greater than Slide Count!');
        return;
      }
    }

    const { quality, ftrAoq } = calculateQualityMetrics();
    onSubmit({
      ...qcFeedback,
      quality,
      ftrAoq
    });
  };

  const handleChange = (field, value) => {
    // Validate slideWithError doesn't exceed slideCount
    if (field === 'slideWithError' && qcFeedback.slideCount) {
      const slideCount = parseInt(qcFeedback.slideCount);
      const slideWithError = parseInt(value);
      if (slideWithError > slideCount) {
        alert(`Slide with Error (${slideWithError}) cannot exceed Slide Count (${slideCount})`);
        return;
      }
    }

    setQCFeedback(prev => ({ ...prev, [field]: value }));
  };

  const metrics = calculateQualityMetrics();

  // Component for Yes/No toggle
  const YesNoToggle = ({ field, label }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="flex gap-2">
        <button
          onClick={() => handleChange(field, 'Yes')}
          className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all ${
            qcFeedback[field] === 'Yes'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ✓ Yes
        </button>
        <button
          onClick={() => handleChange(field, 'No')}
          className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-all ${
            qcFeedback[field] === 'No'
              ? 'bg-red-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          ✗ No
        </button>
      </div>
    </div>
  );

  // Component for Number input
  const NumberInput = ({ field, label, placeholder }) => {
    const maxValue = field === 'slideWithError' && qcFeedback.slideCount
      ? parseInt(qcFeedback.slideCount)
      : undefined;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
          {maxValue && <span className="text-xs text-gray-500 ml-1">(max: {maxValue})</span>}
        </label>
        <input
          type="number"
          value={qcFeedback[field]}
          onChange={(e) => handleChange(field, e.target.value)}
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm font-medium transition-all"
          placeholder={placeholder}
          min="0"
          max={maxValue}
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-[1400px] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-8 py-5 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-xl">QC Feedback Checklist</h2>
            <p className="text-sm text-green-100 mt-1">Job ID: <span className="font-semibold">{ticket.jobId}</span> | Client: <span className="font-semibold">{ticket.clientName}</span></p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl font-bold p-2 hover:bg-white/20 rounded-full transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-8 bg-gray-50">
          {/* Auto-calculated metrics display */}
          <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 flex items-center justify-around">
            <div className="text-center">
              <div className="text-sm font-medium text-blue-100">Quality</div>
              <div className={`text-3xl font-bold mt-1 ${
                parseInt(metrics.quality) === 0 ? 'text-red-300' : parseInt(metrics.quality) === 100 ? 'text-green-300' : 'text-yellow-300'
              }`}>
                {metrics.quality}
              </div>
            </div>
            <div className="h-12 w-px bg-blue-400"></div>
            <div className="text-center">
              <div className="text-sm font-medium text-blue-100">FTR/AOQ</div>
              <div className={`text-2xl font-bold mt-1 ${
                metrics.ftrAoq === 'Yes' ? 'text-green-300' : metrics.ftrAoq === 'No' ? 'text-red-300' : metrics.ftrAoq === 'Pending' ? 'text-yellow-300' : 'text-gray-300'
              }`}>
                {metrics.ftrAoq || '-'}
              </div>
            </div>
          </div>

          {/* Input grid */}
          <div className="grid grid-cols-3 gap-4">
            <NumberInput field="slideCount" label="Slide Count" placeholder="Enter total slides" />
            <NumberInput field="slideWithError" label="Slide with Error" placeholder="Enter slide numbers" />
            <YesNoToggle field="content" label="Content" />
            <YesNoToggle field="instructionMissed" label="Instruction Missed" />
            <YesNoToggle field="layout" label="Layout" />
            <YesNoToggle field="format" label="Format" />
            <YesNoToggle field="formatTable" label="Format - Table" />
            <YesNoToggle field="formatChart" label="Format - Chart" />
            <YesNoToggle field="globalCheck" label="Global Check" />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white px-8 py-5 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-green-700 rounded-lg hover:from-green-700 hover:to-green-800 transition-colors shadow-md hover:shadow-lg"
          >
            Submit QC Feedback
          </button>
        </div>
      </div>
    </div>
  );
};

/* ===================== MAIN TEAM LEAD DASHBOARD ===================== */
const TeamLeadDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [toast, setToast] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedTicketEmails, setSelectedTicketEmails] = useState([]);
  const [loadingEmailsMap, setLoadingEmailsMap] = useState({});
  const [showQCModal, setShowQCModal] = useState(false);
  const [qcTicket, setQCTicket] = useState(null);
  const [showQCViewModal, setShowQCViewModal] = useState(false);
  const [viewTicket, setViewTicket] = useState(null);

  // Column order and visibility
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const savedOrder = localStorage.getItem('teamLeadDashboardColumnOrder');
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder);
        const savedIds = parsed.map(col => col.id);
        const newColumns = DEFAULT_COLUMNS.filter(col => !savedIds.includes(col.id));

        if (newColumns.length > 0) {
          const merged = [...parsed];
          newColumns.forEach(newCol => {
            const defaultIndex = DEFAULT_COLUMNS.findIndex(c => c.id === newCol.id);
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
      console.error('Failed to load column order:', error);
    }
    return DEFAULT_COLUMNS;
  });

  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('teamLeadDashboardColumns');
      if (saved) {
        const parsed = JSON.parse(saved);
        const merged = { ...parsed };
        DEFAULT_COLUMNS.forEach(col => {
          if (!(col.id in merged)) {
            merged[col.id] = col.defaultVisible;
          }
        });
        return merged;
      }
    } catch (error) {
      console.error('Failed to load column visibility:', error);
    }
    return DEFAULT_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.defaultVisible }), {});
  });

  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('teamLeadDashboardCollapsedGroups');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load collapsed groups:', error);
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('teamLeadDashboardColumns', JSON.stringify(visibleColumns));
    } catch (error) {
      console.error('Failed to save column visibility:', error);
    }
  }, [visibleColumns]);

  useEffect(() => {
    try {
      localStorage.setItem('teamLeadDashboardColumnOrder', JSON.stringify(columnOrder));
    } catch (error) {
      console.error('Failed to save column order:', error);
    }
  }, [columnOrder]);

  useEffect(() => {
    try {
      localStorage.setItem('teamLeadDashboardCollapsedGroups', JSON.stringify(collapsedGroups));
    } catch (error) {
      console.error('Failed to save collapsed groups:', error);
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

  // Fixed font sizes matching Tasks.jsx (team member dashboard)
  const fontSize = 'text-[11px]';
  const headerFontSize = 'text-[12px]';
  const badgeFontSize = 'text-[11px]';

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

  // Update ticket field in database
  const updateTicketField = async (ticketId, updates) => {
    try {
      await fetch(`http://localhost:5000/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updates)
      });

      // Update local state
      setTickets(prev => prev.map(t =>
        t._id === ticketId ? { ...t, ...updates } : t
      ));

      showToast('✅ Updated successfully');
    } catch (error) {
      console.error('Error updating ticket:', error);
      showToast('❌ Failed to update');
    }
  };

  // Handle status change
  const handleStatusChange = async (ticket, newStatus) => {
    // If changing to QCD status, show QC feedback modal
    if (newStatus === 'qcd') {
      setQCTicket(ticket);
      setShowQCModal(true);
      return;
    }

    await updateTicketField(ticket._id, { status: newStatus });
  };

  // Handle QC feedback submission
  const handleQCFeedbackSubmit = async (qcFeedback) => {
    if (!qcTicket) return;

    try {
      await updateTicketField(qcTicket._id, {
        status: 'qcd',
        qcFeedback: qcFeedback
      });

      showToast('✅ QC feedback submitted successfully');
      setShowQCModal(false);
      setQCTicket(null);
    } catch (error) {
      console.error('Error submitting QC feedback:', error);
      showToast('❌ Failed to submit QC feedback');
    }
  };

  // Handle estimate change
  const handleEstimateChange = async (ticket, hours, minutes) => {
    const formattedEst = formatEstimate(hours, minutes);
    await updateTicketField(ticket._id, {
      meta: { ...ticket.meta, teamEst: formattedEst }
    });
  };

  // Handle new/edits field change
  const handleFieldChange = async (ticket, field, value) => {
    await updateTicketField(ticket._id, {
      meta: { ...ticket.meta, [field]: value }
    });
  };

  // Handle add client type
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

  // Handle remove client type
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

  // Get status options
  const getStatusOptions = (ticket) => {
    return STATUSES.map(status => ({
      value: status,
      label: STATUS_LABEL[status]
    }));
  };

  /* ======== FETCH TICKETS (FILTERED FOR TEAM LEAD) ======== */
  const fetchTickets = async () => {
    try {
      const res = await ticketAPI.getAllTickets();
      const allTickets = res.data?.tickets || [];

      // Filter tickets where current user is team lead
      const myTeamTickets = allTickets.filter(ticket => {
        const teamLeads = ticket.assignedInfo?.teamLeads || [];
        const teamLead = ticket.assignedInfo?.teamLead || '';

        // Check if user is in teamLeads array or is the teamLead
        return teamLeads.includes(user?.name) || teamLead === user?.name;
      });

      console.log('✅ Team Lead Dashboard - Filtered tickets:', myTeamTickets.length);
      setTickets(myTeamTickets);
    } catch (error) {
      console.error('❌ Error loading tickets:', error);
      showToast("Error loading tickets");
    }
  };

  useEffect(() => {
    fetchTickets();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTickets, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 10000);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /* ======== EMAIL HANDLER ======== */
  const handleOpenEmailModal = async (ticket) => {
    if (!ticket.jobId) {
      showToast("No Job ID found");
      return;
    }

    setSelectedJobId(ticket.jobId);
    setLoadingEmailsMap(prev => ({ ...prev, [ticket._id]: true }));

    let emails = [];
    if (ticket.emails && Array.isArray(ticket.emails) && ticket.emails.length > 0) {
      emails = ticket.emails;
    } else {
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
    setSelectedTicketEmails([]);
  };

  // Render column content (ALL READ-ONLY)
  const renderColumnContent = (columnId, ticket) => {
    const readOnlyClass = `text-[11px] truncate block`;

    switch (columnId) {
      case 'jobId':
        return (
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
        );

      case 'client':
        return <span className={readOnlyClass} title={ticket.clientName}>{ticket.clientName || "-"}</span>;

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
        return <span className={readOnlyClass} title={ticket.consultantName}>{ticket.consultantName || "-"}</span>;

      case 'toCheck':
        const toCheckNames = Array.isArray(ticket.meta?.toCheck)
          ? ticket.meta.toCheck
          : ticket.meta?.toCheck ? [ticket.meta.toCheck] : [];
        return (
          <div className="flex flex-wrap gap-0.5 px-0.5">
            {toCheckNames.length > 0 ? toCheckNames.map((name, idx) => (
              <span key={idx} className={`px-1 py-0.5 bg-purple-100 text-purple-800 rounded ${badgeFontSize} font-medium truncate`}>
                {name}
              </span>
            )) : <span className="text-[11px] text-gray-400">-</span>}
          </div>
        );

      case 'teamLead':
        const teamLeads = ticket.assignedInfo?.teamLeads || [];
        const teamLead = ticket.assignedInfo?.teamLead || '';
        const displayLeads = teamLeads.length > 0 ? teamLeads.join(', ') : teamLead;
        return <span className={readOnlyClass} title={displayLeads}>{displayLeads || "-"}</span>;

      case 'teamMember':
        const teamMembers = ticket.assignedInfo?.teamMembers || [];
        return (
          <div className="flex flex-wrap gap-0.5 px-0.5">
            {teamMembers.length > 0 ? teamMembers.map((member, idx) => (
              <span key={idx} className={`px-1 py-0.5 bg-green-100 text-green-800 rounded ${badgeFontSize} font-medium truncate`}>
                {member}
              </span>
            )) : <span className="text-[11px] text-gray-400">-</span>}
          </div>
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
        return <span className={readOnlyClass}>{ticket.meta?.timezone || "-"}</span>;

      case 'deadline':
        const deadlineValue = formatDeadlineDisplay(ticket.meta?.deadline, ticket.meta?.timezone);
        return <span className={readOnlyClass} title={deadlineValue}>{deadlineValue}</span>;

      case 'istTime':
        return <span className="text-[11px] text-gray-700 font-medium truncate block">{formatDeadlineDisplay(ticket.meta?.deadline, ticket.meta?.timezone)}</span>;

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
            onChange={e => handleFieldChange(ticket, 'new', e.target.value)}
          />
        );

      case 'edits':
        return (
          <input
            className={`${inputClass} truncate`}
            type="text"
            value={ticket.meta?.edits || ""}
            onChange={e => handleFieldChange(ticket, 'edits', e.target.value)}
          />
        );

      case 'fileOutput':
        const fileOutputs = Array.isArray(ticket.meta?.fileOutput)
          ? ticket.meta.fileOutput
          : ticket.meta?.fileOutput ? [ticket.meta.fileOutput] : [];
        return (
          <div className="flex flex-wrap gap-0.5 px-0.5">
            {fileOutputs.length > 0 ? fileOutputs.map((output, idx) => (
              <span key={idx} className={`px-1 py-0.5 bg-indigo-100 text-indigo-800 rounded ${badgeFontSize} font-medium truncate`}>
                {output}
              </span>
            )) : <span className="text-[11px] text-gray-400">-</span>}
          </div>
        );

      case 'proofRead':
        return (
          <select
            className={selectClass}
            value={ticket.meta?.proofRead || ""}
            onChange={e => handleFieldChange(ticket, 'proofRead', e.target.value)}
          >
            <option value="">-</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        );

      case 'mail':
        // Check all possible email fields to get accurate count
        let ticketEmails = [];
        if (ticket.emails && Array.isArray(ticket.emails) && ticket.emails.length > 0) {
          ticketEmails = ticket.emails;
        } else if (ticket.emailData && Array.isArray(ticket.emailData) && ticket.emailData.length > 0) {
          ticketEmails = ticket.emailData;
        } else if (ticket.mail && Array.isArray(ticket.mail) && ticket.mail.length > 0) {
          ticketEmails = ticket.mail;
        } else if (ticket.meta?.emails && Array.isArray(ticket.meta.emails) && ticket.meta.emails.length > 0) {
          ticketEmails = ticket.meta.emails;
        }

        const emailCount = ticketEmails.length;

        return (
          <div
            className="flex items-center justify-center cursor-pointer"
            onClick={() => handleOpenEmailModal(ticket)}
            title={`View emails for ${ticket.jobId} (${emailCount} total)`}
          >
            {loadingEmailsMap[ticket._id] ? (
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <div className="flex items-center gap-1">
                <Mail size={11} className="text-blue-600" />
                <span className={`text-[10px] font-bold ${
                  emailCount > 0 ? 'text-blue-600' : 'text-gray-400'
                }`}>
                  ({emailCount})
                </span>
              </div>
            )}
          </div>
        );

      case 'action':
        return (
          <div className="flex items-center justify-center">
            <Eye size={12} className="text-gray-400" title="View Only" />
          </div>
        );

      default:
        return null;
    }
  };

  // Calculate statistics
  const totalTasks = tickets.length;
  const statusCounts = STATUSES.reduce((acc, status) => {
    acc[status] = tickets.filter(t => t.status === status).length;
    return acc;
  }, {});

  return (
    <div className="p-2 bg-white h-screen overflow-y-auto text-[13px] page-scroll">
      <style>{hideScrollbarStyles}</style>

      {/* Header */}
      <div className="mb-3 pb-3 border-b border-gray-300 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Team Lead Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Welcome, <span className="font-medium text-gray-800">{user?.name}</span>
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-red-700 transition-colors"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>

      <div className="mb-3 flex justify-end">
        <ColumnManager
          columnOrder={columnOrder}
          visibleColumns={visibleColumns}
          onReorderColumns={reorderColumns}
          onToggleColumn={toggleColumn}
          onResetColumns={resetColumns}
        />
      </div>
      {STATUSES.map(status => {
        const statusTickets = tickets.filter(t => t.status === status);
        const count = statusTickets.length;
        const isCollapsed = collapsedGroups[status];

        return (
          <div key={status} className="bg-white border-b border-gray-300">
            {/* HEADER */}
            <div
              className="px-3 py-2 bg-white flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => toggleGroupCollapse(status)}
            >
              <div className="flex items-center gap-2">
                <div className={`${STATUS_BADGE_BG[status]} text-white px-3 py-1 rounded text-[12px] font-medium`}>
                  {STATUS_LABEL[status]} <span className="ml-1 text-[11px] font-semibold">({count})</span>
                </div>
              </div>
              {isCollapsed && count > 0 && (
                <span className="text-[11px] text-gray-500">{count} hidden</span>
              )}
            </div>

            {/* TICKETS - Only show when not collapsed */}
            {!isCollapsed && count > 0 && (
              <div className="overflow-x-auto ticket-scroll">
                {/* COLUMN HEADER */}
                <div className={`grid gap-x-4 px-4 py-2 bg-white text-[11px] font-semibold text-gray-700 border-b border-gray-300 min-w-max`}
                     style={{ gridTemplateColumns: getGridTemplateColumns() }}>
                  {columnOrder.map(column => (
                    visibleColumns[column.id] && <span key={column.id} className="truncate text-center">{column.label}</span>
                  ))}
                </div>

                {/* TICKET ROWS */}
                {statusTickets.map(ticket => (
                  <div key={ticket._id} className="relative group">
                    <div className={`grid gap-x-4 items-center px-4 py-1.5 border-b border-gray-200 hover:bg-blue-50 transition-colors min-w-max`}
                         style={{ gridTemplateColumns: getGridTemplateColumns() }}>
                      {columnOrder.map(column => (
                        visibleColumns[column.id] && (
                          <div key={column.id} className={column.id === 'action' ? '' : 'overflow-hidden'}>
                            {renderColumnContent(column.id, ticket)}
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Email Modal */}
      {showEmailModal && (
        <EmailModal
          jobId={selectedJobId}
          emails={selectedTicketEmails}
          onClose={closeEmailModal}
        />
      )}

      {/* QC Feedback Modal */}
      {showQCModal && qcTicket && (
        <QCFeedbackModal
          ticket={qcTicket}
          onClose={() => {
            setShowQCModal(false);
            setQCTicket(null);
          }}
          onSubmit={handleQCFeedbackSubmit}
        />
      )}

      {/* QC Feedback View Modal */}
      {showQCViewModal && viewTicket && (
        <QCFeedbackViewModal
          ticket={viewTicket}
          onClose={() => {
            setShowQCViewModal(false);
            setViewTicket(null);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
};

export default TeamLeadDashboard;
