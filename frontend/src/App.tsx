import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import BookAppointment from '@/pages/BookAppointment';
import { DashboardLayout } from '@/pages/dashboard/DashboardLayout';
import { DoctorDashboard } from '@/pages/dashboard/DoctorDashboard';
import { AdminDashboard } from '@/pages/dashboard/AdminDashboard';
import { SchedulerDashboard } from '@/pages/dashboard/SchedulerDashboard';
import { DashboardUnavailability } from '@/pages/dashboard/DashboardUnavailability';
import { AdminSettings } from '@/pages/dashboard/AdminSettings';
import { useAuth } from '@/contexts/auth-context';
import { AuthProvider } from '@/contexts/auth-context';
import { ClinicProvider } from '@/contexts/clinic-context';

function ProtectedDashboard({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { token, userRole } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  if (!allowedRoles.includes(userRole)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
            <p className="text-sm text-muted-foreground mt-1">You do not have permission to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  return <DashboardLayout>{children}</DashboardLayout>;
}

function DashboardRoutes() {
  const { userRole } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<BookAppointment />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedDashboard allowedRoles={['admin', 'scheduler', 'doctor', 'patient']}>
            {userRole === 'doctor' ? <DoctorDashboard /> :
             userRole === 'admin' ? <AdminDashboard /> :
             userRole === 'scheduler' ? <SchedulerDashboard /> :
             <AdminDashboard />}
          </ProtectedDashboard>
        }
      />
      <Route
        path="/dashboard/unavailability"
        element={
          <ProtectedDashboard allowedRoles={['admin', 'scheduler']}>
            <DashboardUnavailability />
          </ProtectedDashboard>
        }
      />
      <Route
        path="/dashboard/settings"
        element={
          <ProtectedDashboard allowedRoles={['admin']}>
            <AdminSettings />
          </ProtectedDashboard>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClinicProvider>
          <DashboardRoutes />
        </ClinicProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
