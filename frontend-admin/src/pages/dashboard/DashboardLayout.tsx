import { useState, createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Hospital01Icon,
  Calendar01Icon,
  Settings01Icon,
  Clock01Icon,
  Logout01Icon,
  DashboardSquare01Icon,
  Appointment01Icon,
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
  Calendar02Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

const ContentContainerContext = createContext<{
  containerClass: string;
  setContainerClass: (value: string) => void;
}>({
  containerClass: 'max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200',
  setContainerClass: () => {},
});

export function useContentContainer() {
  return useContext(ContentContainerContext);
}

export function ContentContainerProvider({ children }: { children: React.ReactNode }) {
  const [containerClass, setContainerClass] = useState('max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
  return (
    <ContentContainerContext.Provider value={{ containerClass, setContainerClass }}>
      {children}
    </ContentContainerContext.Provider>
  );
}

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
        { label: 'Today', href: '/dashboard/today', icon: TimeScheduleIcon },
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
        { label: 'Referrals', href: '/dashboard/referrals', icon: ArrowRight01Icon },
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
        { label: 'Today', href: '/dashboard/today', icon: TimeScheduleIcon },
        { label: 'Analytics', href: '/dashboard/analytics', icon: ChartHistogramIcon },
      ],
    },
    {
      label: 'Management',
      items: [
        { label: 'Patients', href: '/dashboard/patients', icon: UserMultiple02Icon },
        { label: 'Unavailability', href: '/dashboard/unavailability', icon: Clock01Icon },
        { label: 'Referrals', href: '/dashboard/referrals', icon: ArrowRight01Icon },
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
        { label: "Today's", href: '/dashboard/today-appointments', icon: Calendar01Icon },
        { label: 'Upcoming', href: '/dashboard/my-appointments', icon: Calendar02Icon },
        { label: 'Calendar', href: '/dashboard/calendar', icon: Calendar01Icon },
        { label: 'Referrals', href: '/dashboard/referrals', icon: ArrowRight01Icon },
      ],
    },
    {
      label: 'Availability',
      items: [
        { label: 'My Unavailability', href: '/dashboard/my-unavailability', icon: Clock01Icon },
        { label: 'Conflicts', href: '/dashboard/conflicts', icon: AlertCircleIcon },
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

  const { containerClass } = useContentContainer();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — Google Calendar-inspired minimal nav */}
      <aside
        className={cn(
          'shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border/60 transition-all duration-300 z-30 select-none',
          collapsed ? 'w-[64px]' : 'w-[220px]'
        )}
      >
        {/* Brand — clean minimal */}
        <div className={cn(
          'flex items-center shrink-0',
          collapsed ? 'justify-center h-14' : 'h-14 px-4 gap-2.5'
        )}>
          <div className="size-7 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={Hospital01Icon} className="size-3.5 text-white" />
          </div>
          {!collapsed && (
            <span className="text-sm font-bold text-sidebar-foreground tracking-tight">MediPort</span>
          )}
        </div>

        {/* Navigation — compact, no group headers */}
        <nav className="flex-1 overflow-y-auto py-1 px-2 scrollbar-none space-y-3">
          {navGroups.map((group, gi) => (
            <div key={gi} className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center w-full rounded-md text-sm transition-all duration-150 relative',
                      collapsed ? 'justify-center h-9' : 'gap-3 h-9 px-3',
                      isActive
                        ? 'bg-emerald-50/70 text-emerald-700 font-medium'
                        : 'text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground/80'
                    )}
                  >
                    {/* Active indicator — thin left bar like GC color dot */}
                    {isActive && !collapsed && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-emerald-500" />
                    )}
                    <HugeiconsIcon
                      icon={item.icon}
                      className={cn(
                        'size-[17px] shrink-0 transition-colors',
                        isActive ? 'text-emerald-600' : 'text-sidebar-foreground/35'
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer — profile + collapse */}
        <div className="border-t border-sidebar-border/60 shrink-0">
          {/* Profile */}
          <div className="relative px-2 pt-1.5 pb-1">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={cn(
                'flex items-center w-full rounded-md transition-colors',
                collapsed ? 'justify-center h-9' : 'gap-2.5 h-9 px-2 hover:bg-sidebar-accent'
              )}
            >
              <div className="size-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white font-semibold text-[10px] shrink-0 shadow-sm">
                {userInitial}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">{otpIdentifier}</p>
                  </div>
                  <HugeiconsIcon
                    icon={ChevronDownIcon}
                    className={cn(
                      'size-3 text-sidebar-foreground/25 transition-transform duration-200',
                      profileOpen && 'rotate-180'
                    )}
                  />
                </>
              )}
            </button>

            {/* Profile Dropdown */}
            {profileOpen && !collapsed && (
              <div className="absolute bottom-full left-2 right-2 mb-1 bg-white rounded-lg shadow-lg shadow-slate-200/60 border border-sidebar-border/60 overflow-hidden z-50">
                <div className="px-3 py-2 border-b border-sidebar-border/40">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{otpIdentifier}</p>
                  <p className="text-[11px] text-sidebar-foreground/40">{roleLabel} Account</p>
                </div>
                <div className="p-1">
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/dashboard/profile'); }}
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded text-xs text-sidebar-foreground/65 hover:bg-sidebar-accent transition-colors"
                  >
                    <HugeiconsIcon icon={UserIcon} className="size-3.5 text-sidebar-foreground/35" />
                    Profile
                  </button>
                  <button
                    onClick={() => { setProfileOpen(false); navigate('/dashboard/settings'); }}
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded text-xs text-sidebar-foreground/65 hover:bg-sidebar-accent transition-colors"
                  >
                    <HugeiconsIcon icon={UserSettingsIcon} className="size-3.5 text-sidebar-foreground/35" />
                    Account Settings
                  </button>
                  <div className="mx-2 my-0.5 h-px bg-sidebar-border/40" />
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded text-xs text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <HugeiconsIcon icon={Logout01Icon} className="size-3.5" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Collapse toggle — subtle */}
          <div className="px-2 pb-1.5">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center w-full h-7 rounded-md text-sidebar-foreground/25 hover:text-sidebar-foreground/50 hover:bg-sidebar-accent transition-colors"
            >
              <HugeiconsIcon icon={collapsed ? Menu01Icon : Menu02Icon} className={collapsed ? 'size-4' : 'size-3.5'} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background">
          <div className={containerClass}>
          {children}
        </div>
      </main>
    </div>
  );
}
