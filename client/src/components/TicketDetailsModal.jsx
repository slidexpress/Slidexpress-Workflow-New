import { X, Clock, User, Calendar, Mail, FileText, Users } from 'lucide-react';

const TicketDetailsModal = ({ job, onClose }) => {
  if (!job) return null;

  const ticket = job.ticket;

  const getStatusColor = (status) => {
    const colors = {
      assigned: 'bg-orange-100 text-orange-800',
      in_process: 'bg-blue-100 text-blue-800',
      paused: 'bg-yellow-100 text-yellow-800',
      rf_qc: 'bg-purple-100 text-purple-800',
      qcd: 'bg-green-100 text-green-800',
      file_received: 'bg-cyan-100 text-cyan-800',
      sent: 'bg-indigo-100 text-indigo-800',
      cancelled: 'bg-red-100 text-red-800',
      not_assigned: 'bg-gray-100 text-gray-800',
      completed: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      assigned: 'Assigned',
      in_process: 'In Progress',
      paused: 'Paused',
      rf_qc: 'Ready for QC',
      qcd: 'QC Done',
      file_received: 'File Received',
      sent: 'Sent',
      cancelled: 'Cancelled',
      not_assigned: 'Not Assigned',
      completed: 'Completed',
    };
    return labels[status] || status;
  };

  const formatTime = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{job.jobId}</h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                  job.status
                )}`}
              >
                {getStatusLabel(job.status)}
              </span>
            </div>
            {ticket.subject && (
              <p className="text-sm text-gray-600 mt-1">{ticket.subject}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Timing Information */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Schedule
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Start Time:</span>
                  <p className="font-semibold text-gray-900">
                    {formatTime(job.startTime)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">End Time:</span>
                  <p className="font-semibold text-gray-900">
                    {formatTime(job.endTime)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <p className="font-semibold text-gray-900">
                    {formatDuration(job.estimateMinutes)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Created:</span>
                  <p className="font-semibold text-gray-900">
                    {formatDate(ticket.createdAt)}
                  </p>
                </div>
              </div>
            </div>

            {/* Client Information */}
            {(ticket.clientName || ticket.clientEmail) && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-600" />
                  Client Information
                </h3>
                <div className="space-y-2 text-sm">
                  {ticket.clientName && (
                    <div className="flex items-start gap-2">
                      <span className="text-gray-600 w-24">Name:</span>
                      <span className="font-medium text-gray-900">
                        {ticket.clientName}
                      </span>
                    </div>
                  )}
                  {ticket.clientEmail && (
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                      <span className="text-gray-600 w-24">Email:</span>
                      <a
                        href={`mailto:${ticket.clientEmail}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {ticket.clientEmail}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Assigned Team Members */}
            {ticket.assignedInfo?.teamMembers &&
              ticket.assignedInfo.teamMembers.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-600" />
                    Assigned Team Members
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {ticket.assignedInfo.teamMembers.map((member, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium"
                      >
                        {member}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {/* Consultant */}
            {ticket.consultantName && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-600" />
                  Consultant
                </h3>
                <p className="text-sm text-gray-700">{ticket.consultantName}</p>
              </div>
            )}

            {/* Message/Description */}
            {ticket.message && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  Description
                </h3>
                <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {ticket.message}
                </div>
              </div>
            )}

            {/* Team Estimate */}
            {ticket.meta?.teamEst && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-600" />
                  Team Estimate
                </h3>
                <p className="text-sm text-gray-700">{ticket.meta.teamEst}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailsModal;
