import { NavLink } from 'react-router-dom';

const UserSidebar = () => {
  const mainNavItems = [
    { name: 'Dashboard', path: '/dashboard/home', icon: '📊' },
    { name: 'Tasks', path: '/dashboard/tasks', icon: '✓' }
  ];

  const profileItem = { name: 'Profile', path: '/dashboard/profile', icon: '👤' };

  return (
    <div className="w-14 bg-gray-50 border-r border-gray-200 fixed left-0 top-0 h-screen flex flex-col items-center z-50 shadow-sm" style={{ paddingTop: '16px', paddingBottom: '16px' }}>
      {/* Main Navigation Items */}
      <div className="flex flex-col items-center" style={{ gap: '12px' }}>
        {mainNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center rounded-md transition-all duration-200 ${
                isActive
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`
            }
            style={{ width: '40px', height: '40px' }}
            title={item.name}
          >
            <span className="text-base">{item.icon}</span>
            <span className="text-[8px] mt-0.5">{item.name}</span>
          </NavLink>
        ))}
      </div>

      {/* Spacer to push profile to bottom */}
      <div style={{ flexGrow: 1 }}></div>

      {/* Profile at Bottom */}
      <div>
        <NavLink
          to={profileItem.path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center rounded-md transition-all duration-200 ${
              isActive
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`
          }
          style={{ width: '40px', height: '40px' }}
          title={profileItem.name}
        >
          <span className="text-base">{profileItem.icon}</span>
          <span className="text-[8px] mt-0.5">{profileItem.name}</span>
        </NavLink>
      </div>
    </div>
  );
};

export default UserSidebar;
