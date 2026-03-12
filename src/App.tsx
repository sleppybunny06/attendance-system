import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './components/DashboardLayout';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LeaveRequestForm from './pages/LeaveRequestForm';

import EmployeeList from './pages/EmployeeList';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return null;
  return user ? <DashboardLayout>{children}</DashboardLayout> : <Navigate to="/login" />;
}

function DashboardRouter() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user?.role === 'admin' ? <>{children}</> : <Navigate to="/" />;
}

import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/" element={<PrivateRoute><DashboardRouter /></PrivateRoute>} />
            <Route path="/leaves" element={<PrivateRoute><LeaveRequestForm /></PrivateRoute>} />
            <Route path="/employees" element={<PrivateRoute><AdminRoute><EmployeeList /></AdminRoute></PrivateRoute>} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
