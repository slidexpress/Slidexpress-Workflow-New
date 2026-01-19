import { useEffect, useState, useMemo } from 'react';
import { Clock, User, Calendar } from 'lucide-react';
import { ticketAPI, teamMemberAPI } from '../utils/api';
import TicketDetailsModal from '../components/TicketDetailsModal';

/* Light gray scrollbar styles */
const scrollbarStyles = `
  .availability-scroll::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .availability-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .availability-scroll::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }
  .availability-scroll::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
  .availability-scroll {
    scrollbar-width: thin;
    scrollbar-color: #d1d5db transparent;
  }
`;
 
const Availability = () => {
  const [loading, setLoading] = useState(true);
  const [allGanttData, setAllGanttData] = useState([]);
  const [ganttData, setGanttData] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
 
 
  useEffect(() => {
    fetchAvailabilityData();

    // Auto-refresh in background every 1 minute
    const interval = setInterval(() => {
      fetchAvailabilityData();
    }, 60000);

    return () => clearInterval(interval);
  }, []);
 
  useEffect(() => {
    if (statusFilter === 'all') {
      setGanttData(allGanttData);
    } else {
      const filteredData = allGanttData
        .map(memberData => {
          const filteredJobs = memberData.jobs.filter(job => job.status === statusFilter);
          return { ...memberData, jobs: filteredJobs };
        })
        .filter(memberData => memberData.jobs.length > 0);
      setGanttData(filteredData);
    }
  }, [statusFilter, allGanttData]);

  // Update current time every minute for live timeline indicator
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timeInterval);
  }, []);
 
 
  const fetchAvailabilityData = async () => {
    try {
      if (document.hidden) return; // Don't refresh if tab is not visible
     
      const statusesToFetch = ['assigned', 'in_process', 'paused', 'rf_qc', 'qcd', 'file_received', 'sent', 'cancelled'];
     
      const [ticketsResponse, teamMembersResponse] = await Promise.all([
        ticketAPI.getAllTickets({ statuses: statusesToFetch.join(',') }),
        teamMemberAPI.getAllTeamMembers(),
      ]);
 
      const tickets = ticketsResponse.data?.tickets || [];
      const members = teamMembersResponse.data?.teamMembers || [];
      setTeamMembers(members);
 
      console.log('All tickets:', tickets);
      console.log('All team members:', members);
      console.log('Total tickets count:', tickets.length);
 
      // No client-side filtering needed as statuses are fetched from API
      const assignedTickets = tickets.filter(ticket => {
        const hasTeamMembers = ticket.assignedInfo?.teamMembers && ticket.assignedInfo.teamMembers.length > 0;
        return hasTeamMembers;
      });
 
      console.log('Assigned tickets:', assignedTickets);
      console.log('Assigned tickets count:', assignedTickets.length);
 
      // Process jobs for Gantt chart
      const ganttRows = buildGanttChart(assignedTickets, members);
 
      console.log('Gantt rows:', ganttRows);

      setAllGanttData(ganttRows);
    } catch (error) {
      console.error('Error fetching availability data:', error);
    } finally {
      setLoading(false);
    }
  };
 
 
  // Parse estimate string like "2h 30m" to total minutes
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
 
  const buildGanttChart = (tickets, teamMembers) => {
    const now = new Date();
   
    console.log('Building Gantt chart for tickets:', tickets);
    console.log('Using team members:', teamMembers);
 
    // Create a map for quick lookup
    const memberMap = new Map(teamMembers.map(m => [m.name, m]));
 
    // Group tickets by team member
    const memberGroups = {};
 
    tickets.forEach(ticket => {
      const teamMembers = ticket.assignedInfo?.teamMembers || [];
      console.log(`Ticket ${ticket.jobId} team members:`, teamMembers);
 
      // Each team member gets this ticket
      teamMembers.forEach(memberName => {
        if (!memberGroups[memberName]) {
          memberGroups[memberName] = [];
        }
        memberGroups[memberName].push(ticket);
      });
    });
 
    console.log('Member groups:', memberGroups);
 
    // Build gantt rows for each member's jobs
    const groupedGanttData = [];
 
    Object.entries(memberGroups).forEach(([memberName, memberTickets]) => {
      const memberData = memberMap.get(memberName);
      const memberStartTime = memberData?.startTime || '08:00'; // Default to 8 AM
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

        // If ticket has been started and has remaining time, use that instead of original estimate
        if (ticket.meta?.remainingSeconds !== undefined && ticket.meta?.remainingSeconds !== null) {
          const remainingMinutes = Math.round(ticket.meta.remainingSeconds / 60);
          return numMembers > 1 ? Math.round(remainingMinutes / numMembers) : remainingMinutes;
        }

        // Otherwise use the original estimate
        const totalEstimateMinutes = parseEstimateToMinutes(ticket.meta?.teamEst);
        return numMembers > 1 ? Math.round(totalEstimateMinutes / numMembers) : totalEstimateMinutes;
      };
 
      // Sort all tickets for this member to ensure a consistent order
      // Sort tickets: in_process first (by startedAt), then others by createdAt
      // This ensures only ONE task can truly be in progress
      memberTickets.sort((a, b) => {
        const aInProgress = a.status === 'in_process';
        const bInProgress = b.status === 'in_process';

        if (aInProgress && !bInProgress) return -1;
        if (!aInProgress && bInProgress) return 1;

        if (aInProgress && bInProgress) {
          // Both in progress - sort by startedAt (earliest first)
          const aTime = a.startedAt ? new Date(a.startedAt) : new Date(a.createdAt);
          const bTime = b.startedAt ? new Date(b.startedAt) : new Date(b.createdAt);
          return aTime - bTime;
        }

        // Both not in progress - sort by createdAt
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
 
      let hasActiveTask = false; // Track if we've already placed the active in-progress task

      memberTickets.forEach(ticket => {
        const estimateMinutes = calculatePerMemberEstimate(ticket);
       
        if (currentTime >= breakStart && currentTime < breakEnd) {
            currentTime = new Date(breakEnd);
        }
 
        let startTime;
        // Only the FIRST in_process task can use its actual startedAt time
        if (ticket.startedAt && ticket.status === 'in_process' && !hasActiveTask) {
          // This is the currently active in-progress task
          startTime = new Date(ticket.startedAt);
          hasActiveTask = true;
        } else {
          // All other tasks (including additional "in_process" tasks) are scheduled in queue
          startTime = new Date(currentTime);
        }
        let endTime = new Date(startTime.getTime() + estimateMinutes * 60000);
 
        if (startTime < breakStart && endTime > breakStart) {
            endTime = new Date(endTime.getTime() + 60 * 60000);
        }
 
        memberJobs.push({
          id: `${ticket._id}-${memberName}`,
          jobId: ticket.jobId || 'N/A',
          status: ticket.status,
          estimateMinutes: estimateMinutes,
          startTime: startTime,
          endTime: endTime,
          ticket: ticket
        });
        currentTime = endTime;
      });
     
      groupedGanttData.push({ memberName, jobs: memberJobs });
    });
 
    // Calculate the end time of the last job for each member for sorting
    groupedGanttData.forEach(memberData => {
        if (memberData.jobs.length > 0) {
            const lastJob = memberData.jobs.reduce((latest, job) => {
                return job.endTime > latest.endTime ? job : latest;
            }, memberData.jobs[0]);
            memberData.lastJobEndTime = lastJob.endTime;
        } else {
            // If a member has no jobs, their availability is their start time.
            const memberInfo = memberMap.get(memberData.memberName);
            const memberStartTime = memberInfo?.startTime || '08:00';
            const [startHour, startMinute] = memberStartTime.split(':').map(Number);
            const todayStartForMember = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute, 0);
            memberData.lastJobEndTime = todayStartForMember;
        }
    });
 
    // Sort by the end time of the last job (earliest available first)
    groupedGanttData.sort((a, b) => a.lastJobEndTime - b.lastJobEndTime);
 
    console.log('Final gantt rows:', groupedGanttData);
 
    return groupedGanttData;
  };
 
  // Calculate lanes for overlapping jobs to prevent visual overlap
  const calculateJobLanes = (jobs) => {
    // Sort jobs by start time
    const sortedJobs = [...jobs].sort((a, b) => a.startTime - b.startTime);
    const lanes = [];

    sortedJobs.forEach(job => {
      // Find the first available lane where this job doesn't overlap
      let laneIndex = 0;
      let placed = false;

      while (!placed) {
        if (!lanes[laneIndex]) {
          lanes[laneIndex] = [];
        }

        // Check if this job overlaps with any job in this lane
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
    if (status === 'in_process') {
      return 'bg-blue-600'; // Prominent color for in-progress tasks
    }
    return 'bg-gray-300'; // Grayed out for all other tasks
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
    };
    return labels[status] || status;
  };
 
  const getStatusTextColor = (status) => {
    if (status === 'in_process') {
      return 'text-white';
    }
    return 'text-gray-700'; // Contrasting text for grayed-out bars
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
 
  // Calculate position and width for timeline bar
  const getTimelinePosition = (startTime, endTime) => {
    const dayStart = new Date(startTime);
    dayStart.setHours(8, 0, 0, 0); // 8 AM
    const dayEnd = new Date(startTime);
    dayEnd.setHours(20, 0, 0, 0); // 8 PM
 
    const totalMinutes = 12 * 60; // 8 AM to 8 PM = 12 hours
    const startMinutes = (startTime - dayStart) / 60000;
    const durationMinutes = (endTime - startTime) / 60000;
 
    const leftPercent = Math.max(0, Math.min(100, (startMinutes / totalMinutes) * 100));
    const widthPercent = Math.max(0.5, Math.min(100 - leftPercent, (durationMinutes / totalMinutes) * 100));
 
    return { left: `${leftPercent}%`, width: `${widthPercent}%` };
  };
 
  // Generate hour markers for timeline (8 AM to 8 PM)
  const hourMarkers = Array.from({ length: 13 }, (_, i) => {
    const hour = 8 + i;
    const displayHour = hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return { hour, display: `${displayHour} ${ampm}`, percent: (i / 12) * 100 };
  });
 
  // Calculate current time position on timeline
  const getCurrentTimePosition = () => {
    const now = currentTime;
    const dayStart = new Date(now);
    dayStart.setHours(8, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setHours(20, 0, 0, 0);
 
    // Check if current time is within 8 AM - 8 PM
    if (now < dayStart || now > dayEnd) {
      return null;
    }
 
    const totalMinutes = 12 * 60; // 8 AM to 8 PM = 12 hours
    const currentMinutes = (now - dayStart) / 60000;
    const percent = (currentMinutes / totalMinutes) * 100;
 
    return percent;
  };
 
  const currentTimePercent = getCurrentTimePosition();
 
  const statusCounts = useMemo(() => {
    return allGanttData.reduce((acc, memberData) => {
      memberData.jobs.forEach(job => {
        if (job.status) {
          acc[job.status] = (acc[job.status] || 0) + 1;
        }
      });
      return acc;
    }, {});
  }, [allGanttData]);
 
  const filterableStatuses = ['assigned', 'in_process', 'paused', 'rf_qc', 'qcd', 'file_received', 'sent', 'cancelled'];
 
 
  if (loading) {
    return (
      <div className="p-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="ml-4 text-gray-600">Loading availability data...</p>
          </div>
        </div>
      </div>
    );
  }
 
  return (
    <div className="p-4 bg-gray-50 h-screen overflow-auto availability-scroll">
      <style>{scrollbarStyles}</style>
      <div className="mb-3">
        <h1 className="text-xl font-bold text-gray-900">Team Availability</h1>
      </div>
 
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <button onClick={() => setStatusFilter('all')} className={`px-2.5 py-0.5 text-xs rounded-full ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
            All ({allGanttData.reduce((acc, member) => acc + member.jobs.length, 0)})
        </button>
        {filterableStatuses.map(status => (
            <button key={status} onClick={() => setStatusFilter(status)} className={`px-2.5 py-0.5 text-xs rounded-full ${statusFilter === status ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                {getStatusLabel(status)} ({statusCounts[status] || 0})
            </button>
        ))}
      </div>
 
      <div className="bg-white rounded-lg shadow-lg overflow-x-auto availability-scroll">
        {/* Timeline Header */}
        <div className="bg-gray-50 border-b-2 border-gray-300 py-1 px-2 border-l-4 border-l-transparent sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-40 font-medium text-[11px] text-gray-700">Team Member</div>
            <div className="flex-1 relative pr-2" style={{ minWidth: '1200px' }}>
              {/* Hour labels */}
              <div className="relative h-4 flex items-end">
                {hourMarkers.map(marker => (
                  <div
                    key={marker.hour}
                    className="absolute text-[10px] text-gray-600 font-medium"
                    style={{ left: `${marker.percent}%`, transform: 'translateX(-50%)' }}
                  >
                    {marker.display}
                  </div>
                ))}
              </div>
 
              {/* Timeline base */}
              <div className="relative h-1 bg-gray-200 rounded-full">
                {/* Hour markers */}
                {hourMarkers.map((marker, idx) => (
                  idx > 0 && idx < hourMarkers.length - 1 && (
                    <div
                      key={marker.hour}
                      className="absolute top-0 bottom-0 w-px bg-gray-400"
                      style={{ left: `${marker.percent}%` }}
                    ></div>
                  )
                ))}
 
                {/* Current time indicator in header */}
                {currentTimePercent !== null && (
                  <div
                    className="absolute -top-8 bottom-0 w-1 bg-blue-600 z-40 animate-pulse"
                    style={{ left: `${currentTimePercent}%` }}
                  >
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-md font-bold shadow-xl whitespace-nowrap">
                      {formatTime(currentTime)}
                    </div>
                  </div>
                )}
              </div>
            </div>
 
          </div>
        </div>
 
        {/* Gantt Chart Body */}
        <div className="divide-y divide-gray-200">
          {ganttData.length === 0 ? (
            <div className="p-16 text-center text-gray-500">
              <Clock className="w-20 h-20 mx-auto mb-4 text-gray-300" />
              <p className="text-xl font-medium mb-2">No assigned jobs found</p>
              <p className="text-sm text-gray-400">
                Active jobs (assigned, in progress, paused, or ready for QC) will appear here
              </p>
            </div>
          ) : (
            ganttData.map((memberData) => {
              // Calculate lanes for this member's jobs to prevent overlap
              const numLanes = calculateJobLanes(memberData.jobs);
              const rowHeight = Math.max(24, numLanes * 18); // 18px per lane, minimum 24px

              return (
                <div
                  key={memberData.memberName}
                  className="py-1 px-2 hover:bg-blue-50/50 transition-all duration-200 border-l-4 border-transparent hover:border-blue-500"
                >
                  <div className="flex items-center gap-2">
                    {/* Member Info Column */}
                    <div className="w-40 flex-shrink-0">
                      <div className="mb-0">
                        <span className="font-semibold text-gray-800 text-[11px] inline-block truncate">
                          {memberData.memberName}
                          {memberData.jobs.length > 1 && (
                            <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[9px] font-bold">
                              {memberData.jobs.length}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Timeline Column */}
                    <div className="flex-1 relative pr-2" style={{ height: `${rowHeight}px`, minWidth: '1200px' }}>
                      {/* Background grid */}
                      <div className="absolute inset-0">
                        {hourMarkers.map((marker, idx) => (
                          idx > 0 && idx < hourMarkers.length - 1 && (
                            <div
                              key={marker.hour}
                              className="absolute top-0 bottom-0 border-l border-dashed border-slate-300/60"
                              style={{ left: `${marker.percent}%` }}
                            ></div>
                          )
                        ))}
                      </div>

                      {/* Job bars for this member */}
                      {memberData.jobs.map(row => {
                        const position = getTimelinePosition(row.startTime, row.endTime);
                        const laneIndex = row.lane || 0;
                        const barHeight = 16; // Height of each bar
                        const laneSpacing = 18; // Space between lanes
                        const topOffset = laneIndex * laneSpacing + 2; // 2px padding from top

                        return (
                          <div
                            key={row.id}
                            className={`absolute ${getStatusColor(row.status)} rounded flex items-center px-1.5 ${getStatusTextColor(row.status)} text-[9px] font-medium transition-all duration-150 hover:opacity-80 cursor-pointer ${row.status === 'in_process' ? 'shadow-md border-2 border-blue-800' : 'opacity-60 shadow-sm border border-white/40'}`}
                            style={{
                              left: position.left,
                              width: position.width,
                              minWidth: '45px',
                              height: `${barHeight}px`,
                              top: `${topOffset}px`,
                              zIndex: 10 + laneIndex
                            }}
                            onClick={() => setSelectedJob(row)}
                            title={`${row.jobId}\n${row.ticket.assignedInfo?.teamMembers.join(', ')}\n${formatTime(row.startTime)} - ${formatTime(row.endTime)}\nDuration: ${formatDuration(row.estimateMinutes)}`}
                          >
                            <span className="truncate flex-1">{row.jobId}</span>
                            <span className="ml-1 text-[8px] whitespace-nowrap opacity-90">
                              {formatDuration(row.estimateMinutes)}
                            </span>
                          </div>
                        );
                      })}

                      {/* Current time indicator line */}
                      {currentTimePercent !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-red-500 z-50 pointer-events-none"
                          style={{ left: `${currentTimePercent}%` }}
                        ></div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
 
      {selectedJob && (
        <TicketDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
};
 
export default Availability;
 