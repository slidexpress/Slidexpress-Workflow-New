import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';
import Sidebar from '../components/Sidebar';

const CoordinatorDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 ml-14 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white shadow-sm border-b flex-shrink-0">
          <div className="px-6 py-2 flex justify-between items-center">
            <div>
              <h1 className="text-sm font-bold text-gray-900">Workflow Coordinator</h1>
              <p className="text-xs text-gray-600">
                Welcome, {user?.name}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 transition text-xs"
              title="Logout"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default CoordinatorDashboard;
