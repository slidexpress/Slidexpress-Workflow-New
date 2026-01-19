import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user } = useAuth();

  const formatRole = (role) => {
    return role?.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className="p-8 h-full overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
          <p className="text-gray-600">View your account information and details</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header Section with Avatar */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-8 py-12">
            <div className="flex items-center space-x-6">
              {/* Avatar */}
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-4xl font-bold text-blue-600 shadow-lg">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              {/* User Basic Info */}
              <div className="text-white">
                <h2 className="text-3xl font-bold mb-1">{user?.name}</h2>
                <p className="text-blue-100 text-lg">{formatRole(user?.role)}</p>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="px-8 py-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b">
              Account Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Email Address
                </label>
                <p className="text-lg text-gray-900 font-medium">{user?.email}</p>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Role
                </label>
                <p className="text-lg text-gray-900 font-medium">{formatRole(user?.role)}</p>
              </div>

              {/* Workspace */}
              {user?.workspace && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Workspace
                  </label>
                  <p className="text-lg text-gray-900 font-medium">{user.workspace.name}</p>
                  {user.workspace.description && (
                    <p className="text-sm text-gray-600">{user.workspace.description}</p>
                  )}
                </div>
              )}

              {/* Team Lead */}
              {user?.teamLead && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Team Lead
                  </label>
                  <p className="text-lg text-gray-900 font-medium">{user.teamLead.name}</p>
                  <p className="text-sm text-gray-600">{user.teamLead.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Info Section */}
          <div className="bg-gray-50 px-8 py-6 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Login Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Login Status
                </label>
                <p className="text-sm text-gray-900">
                  {user?.isFirstLogin ? (
                    <span className="text-orange-600 font-medium">
                      ⚠️ First login - Password reset required
                    </span>
                  ) : (
                    <span className="text-green-600 font-medium">
                      ✓ Password configured
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information Notice */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Note:</span> If you need to update any account information,
            please contact your IT administrator at{' '}
            <a href="mailto:techsupport@mecstudio.com" className="underline hover:text-blue-900">
              techsupport@mecstudio.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
