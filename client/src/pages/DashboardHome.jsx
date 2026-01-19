import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { teamMemberAPI } from '../utils/api';

const DashboardHome = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    completed: 0
  });

  useEffect(() => {
    fetchUserTasks();
  }, [user]);

  const fetchUserTasks = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('DashboardHome - Fetching tasks for user:', user.name, user.email);
      const response = await teamMemberAPI.getMyTasks();
      console.log('DashboardHome - API Response:', response.data);
      const userTasks = response.data?.tasks || [];
      setTasks(userTasks);

      // Calculate statistics
      const total = userTasks.length;
      const inProgress = userTasks.filter(t =>
        t.status === 'assigned' || t.status === 'in_process' || t.status === 'rf_qc'
      ).length;
      const completed = userTasks.filter(t =>
        t.status === 'qcd' || t.status === 'sent'
      ).length;

      setStats({ total, inProgress, completed });
    } catch (error) {
      console.error('Error fetching user tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatRole = (role) => {
    return role?.replace(/_/g, ' ').toUpperCase();
  };

  const getStatusColor = (status) => {
    const colors = {
      not_assigned: 'bg-red-600',
      assigned: 'bg-yellow-600',
      in_process: 'bg-blue-600',
      rf_qc: 'bg-purple-600',
      qcd: 'bg-green-600',
      file_received: 'bg-orange-600',
      sent: 'bg-teal-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  const getStatusLabel = (status) => {
    const labels = {
      not_assigned: 'Not Assigned',
      assigned: 'Assigned',
      in_process: 'In Progress',
      rf_qc: 'Ready for QC',
      qcd: 'QC Done',
      file_received: 'File Received',
      sent: 'Sent'
    };
    return labels[status] || status;
  };

  return (
    <div className="p-8 h-full overflow-auto bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600">Here's what's happening with your tasks today.</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Tasks</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? '...' : stats.total}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">In Progress</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? '...' : stats.inProgress}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⏳</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Completed</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? '...' : stats.completed}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
        </div>

        {/* User Information Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Your Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="font-semibold text-gray-700">Name:</span>
              <span className="ml-2 text-gray-900">{user?.name}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Email:</span>
              <span className="ml-2 text-gray-900">{user?.email}</span>
            </div>
            <div>
              <span className="font-semibold text-gray-700">Role:</span>
              <span className="ml-2 text-gray-900">{formatRole(user?.role)}</span>
            </div>
            {user?.workspace && (
              <div>
                <span className="font-semibold text-gray-700">Workspace:</span>
                <span className="ml-2 text-gray-900">{user.workspace.name}</span>
              </div>
            )}
            {user?.teamLead && (
              <div className="md:col-span-2">
                <span className="font-semibold text-gray-700">Team Lead:</span>
                <span className="ml-2 text-gray-900">
                  {user.teamLead.name} ({user.teamLead.email})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Recent Tasks</h2>
            <a href="/dashboard/tasks" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              View All →
            </a>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4">Loading your tasks...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-lg">No tasks assigned yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Tasks assigned to you will appear here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-[12px] font-bold text-gray-700">
                      Job ID
                    </th>
                    <th className="px-3 py-1.5 text-left text-[12px] font-bold text-gray-700">
                      Client
                    </th>
                    <th className="px-3 py-1.5 text-left text-[12px] font-bold text-gray-700">
                      Consultant
                    </th>
                    <th className="px-3 py-1.5 text-left text-[12px] font-bold text-gray-700">
                      File Output
                    </th>
                    <th className="px-3 py-1.5 text-left text-[12px] font-bold text-gray-700">
                      Status
                    </th>
                    <th className="px-3 py-1.5 text-left text-[12px] font-bold text-gray-700">
                      Deadline
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {tasks.slice(0, 5).map((task) => (
                    <tr key={task._id} className="hover:bg-gray-50 border-b border-gray-100">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                          {task.jobId || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="text-[11px] text-gray-800 font-medium truncate">
                          {task.clientName || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="text-[11px] text-gray-700 truncate">
                          {task.consultantName || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className="text-[11px] text-gray-800 font-semibold bg-blue-50 px-2 py-1 rounded inline-block">
                          {task.meta?.fileOutput || '-'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold text-white ${getStatusColor(task.status)}`}>
                          {getStatusLabel(task.status)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-[11px] text-gray-900">
                        {task.meta?.deadline ? new Date(task.meta.deadline).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
