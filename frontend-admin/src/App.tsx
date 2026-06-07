import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ClinicProvider } from '@/contexts/clinic-context';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardLayout, ContentContainerProvider } from '@/pages/dashboard/DashboardLayout';
import { AdminDashboard } from '@/pages/dashboard/AdminDashboard';
import { DoctorDashboard } from '@/pages/dashboard/DoctorDashboard';
import { DoctorTodayAppointmentsPage } from '@/pages/dashboard/DoctorTodayAppointmentsPage';
import { TodayPage } from '@/pages/dashboard/TodayPage';
import { DoctorAppointmentsPage } from '@/pages/dashboard/DoctorAppointmentsPage';
import { DoctorUnavailabilityPage } from '@/pages/dashboard/DoctorUnavailabilityPage';
import { DoctorConflictsPage } from '@/pages/dashboard/DoctorConflictsPage';
import { DoctorReferralsPage } from '@/pages/dashboard/DoctorReferralsPage';
import { CalendarPage } from '@/pages/dashboard/CalendarPage';
import { SchedulerDashboard } from '@/pages/dashboard/SchedulerDashboard';
import { DashboardUnavailability } from '@/pages/dashboard/DashboardUnavailability';
import { AdminSettings } from '@/pages/dashboard/AdminSettings';
import { ApplicationSettingsPage } from '@/pages/dashboard/ApplicationSettingsPage';
import { DoctorProfilePage } from '@/pages/dashboard/DoctorProfilePage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { DoctorsPage } from '@/pages/DoctorsPage';
import { DoctorSchedulesPage } from '@/pages/DoctorSchedulesPage';
import { PatientSearchPage } from '@/pages/PatientSearchPage';
import { UsersPage } from '@/pages/UsersPage';

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { token, userRole } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const staffRoles = ['admin', 'scheduler', 'doctor'];
  if (!staffRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function DashboardRouter() {
  const { token, userRole } = useAuth();

  if (!token) return null;

  if (userRole === 'doctor') return <DoctorDashboard />;
  if (userRole === 'scheduler') return <SchedulerDashboard />;
  return <AdminDashboard />;
}

function AppRoutes() {
  return (
    <ContentContainerProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <DashboardRouter />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route
        path="/dashboard/my-appointments"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <DoctorAppointmentsPage />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route
        path="/dashboard/today-appointments"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <DoctorTodayAppointmentsPage />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route
        path="/dashboard/today"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <TodayPage />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route
        path="/dashboard/my-unavailability"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <DoctorUnavailabilityPage />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route
        path="/dashboard/conflicts"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <DoctorConflictsPage />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route
        path="/dashboard/referrals"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <DoctorReferralsPage />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route
        path="/dashboard/schedules"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <DoctorSchedulesPage />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route
        path="/dashboard/patients"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <PatientSearchPage />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route
        path="/dashboard/users"
        element={
          <DashboardGuard>
            <DashboardLayout>
              <UsersPage />
            </DashboardLayout>
          </DashboardGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ContentContainerProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClinicProvider>
          <AppRoutes />
        </ClinicProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
