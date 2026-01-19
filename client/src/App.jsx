import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/AdminDashboard';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import CoordinatorDashboardHome from './pages/CoordinatorDashboardHome';
import Availability from './pages/Availability';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import UserDashboard from './pages/UserDashboard';
import DashboardHome from './pages/DashboardHome';
import Tasks from './pages/Tasks';
import EmailsPage from './pages/EmailsPage';
import TeamLeadDashboard from './pages/TeamLeadDashboard';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected Routes - Admin */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['it_admin', 'super_admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Workflow Coordinator */}
          <Route
            path="/coordinator"
            element={
              <ProtectedRoute allowedRoles={['workflow_coordinator', 'it_admin', 'super_admin']}>
                <CoordinatorDashboard />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/coordinator/dashboard" replace />} />
            <Route path="dashboard" element={<CoordinatorDashboardHome />} />
            <Route path="availability" element={<Availability />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Protected Routes - Team Lead */}
          <Route
            path="/team-lead/dashboard"
            element={
              <ProtectedRoute allowedRoles={['team_lead', 'it_admin', 'super_admin']}>
                <TeamLeadDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected Routes - Regular Users */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard/home" replace />} />
            <Route path="home" element={<DashboardHome />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Route to open emails in new window/tab */}
          <Route path="/emails/:jobId" element={<EmailsPage />} />

          {/* Default & fallback */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
