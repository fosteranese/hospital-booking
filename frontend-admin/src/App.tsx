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
import { DoctorPastAppointmentsPage } from '@/pages/dashboard/DoctorPastAppointmentsPage';
import { SchedulerDashboard } from '@/pages/dashboard/SchedulerDashboard';
import { ApplicationSettingsPage } from '@/pages/dashboard/ApplicationSettingsPage';
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

function dashboardRoute(path: string, page: React.ReactNode) {
  return (
    <Route path={path} element={<DashboardGuard><DashboardLayout>{page}</DashboardLayout></DashboardGuard>} />
  );
}

function AppRoutes() {
  return (
    <ContentContainerProvider>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        {dashboardRoute('/dashboard', <DashboardRouter />)}
        {dashboardRoute('/dashboard/my-appointments', <DoctorAppointmentsPage />)}
        {dashboardRoute('/dashboard/today-appointments', <DoctorTodayAppointmentsPage />)}
        {dashboardRoute('/dashboard/today', <TodayPage />)}
        {dashboardRoute('/dashboard/my-unavailability', <DoctorUnavailabilityPage />)}
        {dashboardRoute('/dashboard/conflicts', <DoctorConflictsPage />)}
        {dashboardRoute('/dashboard/referrals', <DoctorReferralsPage />)}
        {dashboardRoute('/dashboard/past-appointments', <DoctorPastAppointmentsPage />)}
        {dashboardRoute('/dashboard/schedules', <DoctorSchedulesPage />)}
        {dashboardRoute('/dashboard/patients', <PatientSearchPage />)}
        {dashboardRoute('/dashboard/users', <UsersPage />)}
        {dashboardRoute('/dashboard/app-settings', <ApplicationSettingsPage />)}
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
