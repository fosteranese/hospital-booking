import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Hospital01Icon,
  Calendar01Icon,
  Settings01Icon,
  Clock01Icon,
  Logout01Icon,
  DashboardSquare01Icon,
  UserGroupIcon,
  ChartHistogramIcon,
  UserMultiple02Icon,
  StethoscopeIcon,
  TimeScheduleIcon,
  Menu01Icon,
  Menu02Icon,
  ChevronDownIcon,
  UserIcon,
  UserSettingsIcon,
} from '@hugeicons/core-free-icons';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const roleNav: Record<string, NavGroup[]> = {
  admin: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: Calendar01Icon },
        { label: 'Analytics', href: '/dashboard/analytics', icon: ChartHistogramIcon },
      ],
    },
    {
      label: 'Management',
      items: [
        { label: 'Doctors', href: '/dashboard/doctors', icon: StethoscopeIcon },
        { label: 'Schedules', href: '/dashboard/schedules', icon: TimeScheduleIcon },
        { label: 'Patients', href: '/dashboard/patients', icon: UserMultiple02Icon },
        { label: 'Unavailability', href: '/dashboard/unavailability', icon: Clock01Icon },
      ],
    },
    {
      label: 'System',
      items: [
        { label: 'Users', href: '/dashboard/users', icon: UserGroupIcon },
        { label: 'App Settings', href: '/dashboard/app-settings', icon: Settings01Icon },
      ],
    },
  ],
  scheduler: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: Calendar01Icon },
        { label: 'Analytics', href: '/dashboard/analytics', icon: ChartHistogramIcon },
      ],
    },
    {
      label: 'Management',
      items: [
        { label: 'Patients', href: '/dashboard/patients', icon: UserMultiple02Icon },
        { label: 'Unavailability', href: '/dashboard/unavailability', icon: Clock01Icon },
      ],
    },
  ],
  doctor: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: DashboardSquare01Icon },
      ],
    },
    {
      label: 'Appointments',
      items: [
        { label: "Today's Appointments", href: '/dashboard/today-appointments', icon: Calendar01Icon },
        { label: 'Upcoming Appointments', href: '/dashboard/my-appointments', icon: Calendar01Icon },
        { label: 'Calendar', href: '/dashboard/calendar', icon: Calendar01Icon },
      ],
    },
    {
      label: 'Availability',
      items: [
        { label: 'My Unavailability', href: '/dashboard/my-unavailability', icon: Clock01Icon },
      ],
    },
  ],
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userRole, clearAuth, otpIdentifier } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const role = (userRole in roleNav ? userRole : 'admin') as keyof typeof roleNav;
  const navGroups = roleNav[role];
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const userInitial = otpIdentifier.charAt(0).toUpperCase();

  const handleSignOut = () => {
    clearAuth();
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      {/* Sidebar */}
      <aside
        className={cn(
          'shrink-0 flex flex-col bg-white border-r border-slate-200/80 transition-all duration-300 ease-in-out',
          collapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center h-16 border-b border-slate-100 shrink-0',
          collapsed ? 'justify-center px-3' : 'px-5'
        )}>
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm shadow-emerald-200">
              <HugeiconsIcon icon={Hospital01Icon} className="size-[18px] text-white" />
            </div>
            {!collapsed && (
              <div className="animate-in fade-in slide-in-from-left-2 duration-200">
                <p className="text-sm font-bold text-slate-900 tracking-tight leading-none">MediPort</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Staff Portal</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-none">
          {navGroups.map((group, gi) => (
            <div key={gi} className={cn(!collapsed && 'mb-4')}>
              {!collapsed && (
                <p className="px-5 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {group.label}
                </p>
              )}
              <div className={cn('space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
                {group.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <button
                      key={item.href}
                      onClick={() => navigate(item.href)}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 w-full rounded-lg text-[13px] font-medium transition-all duration-150',
                        collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100/50'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      <HugeiconsIcon
                        icon={item.icon}
                        className={cn(
                          'size-[18px] shrink-0 transition-colors',
                          isActive ? 'text-emerald-600' : 'text-slate-400'
                        )}
                      />
                      {!collapsed && <span>{item.label}</span>}
                      {isActive && !collapsed && (
                        <div className="ml-auto size-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile */}
        <div className={cn(
          'border-t border-slate-100 shrink-0',
          collapsed ? 'p-2' : 'p-3'
        )}>
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={cn(
                'flex items-center w-full rounded-lg transition-colors hover:bg-slate-50',
                collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2'
              )}
            >
              <div className={cn(
                'rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-semibold shrink-0',
                collapsed ? 'size-9 text-sm' : 'size-9 text-sm'
              )}>
                {userInitial}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-slate-900 truncate">{otpIdentifier}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{roleLabel}</p>
                  </div>
                  <HugeiconsIcon
                    icon={ChevronDownIcon}
                    className={cn(
                      'size-4 text-slate-400 transition-transform duration-200',
                      profileOpen && 'rotate-180'
                    )}
                  />
                </>
              )}
            </button>

            {/* Profile Dropdown */}
            {profileOpen && !collapsed && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg shadow-slate-200/50 border border-slate-200/80 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                <div className="p-3 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900 truncate">{otpIdentifier}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{roleLabel} Account</p>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/dashboard/profile');
                    }}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <HugeiconsIcon icon={UserIcon} className="size-4 text-slate-400" />
                    My Profile
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/dashboard/settings');
                    }}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                  >
                    <HugeiconsIcon icon={UserSettingsIcon} className="size-4 text-slate-400" />
                    Account Settings
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <HugeiconsIcon icon={Logout01Icon} className="size-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Collapse Toggle */}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="flex items-center justify-center w-full mt-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <HugeiconsIcon icon={Menu02Icon} className="size-4" />
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="flex items-center justify-center w-full mt-1 py-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <HugeiconsIcon icon={Menu01Icon} className="size-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
