import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaTasks, FaProjectDiagram, FaUsers } from 'react-icons/fa';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const cards = [
    {
      title: "Tasks",
      description: "Manage tasks",
      icon: <FaTasks className="text-white w-6 h-6" />,
      bgColor: "bg-blue-500",
    },
    {
      title: "Projects",
      description: "View projects",
      icon: <FaProjectDiagram className="text-white w-6 h-6" />,
      bgColor: "bg-green-500",
    },
    {
      title: "Team",
      description: "Team overview",
      icon: <FaUsers className="text-white w-6 h-6" />,
      bgColor: "bg-yellow-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-600">Welcome, {user?.name}</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 text-sm"
        >
          Logout
        </button>
      </header>

      {/* Compact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="flex items-center p-3 bg-white rounded shadow hover:shadow-md transition cursor-pointer"
          >
            <div className={`${card.bgColor} p-3 rounded-full flex items-center justify-center mr-3`}>
              {card.icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">{card.title}</h3>
              <p className="text-gray-600 text-xs">{card.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* User Info Compact Panel */}
      <div className="mt-6 bg-white p-4 rounded shadow text-sm">
        <h2 className="font-semibold mb-2">Your Info</h2>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="font-medium">Name:</span> {user?.name}</div>
          <div><span className="font-medium">Email:</span> {user?.email}</div>
          <div><span className="font-medium">Role:</span> {user?.role?.replace(/_/g, ' ').toUpperCase()}</div>
          {user?.workspace && <div><span className="font-medium">Workspace:</span> {user.workspace.name}</div>}
          {user?.teamLead && (
            <div>
              <span className="font-medium">Team Lead:</span> {user.teamLead.name}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
