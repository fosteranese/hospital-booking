import { useState, useEffect, useCallback, createContext, useContext } from 'react';
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
import { RefreshProvider } from '@/contexts/refresh-context';
import { RefreshIndicator } from '@/components/RefreshIndicator';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
        { label: 'Past', href: '/dashboard/past-appointments', icon: TimeScheduleIcon },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'system';
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    return 'system';
  });

  const applyTheme = useCallback((t: 'light' | 'dark' | 'system') => {
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme, applyTheme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, applyTheme]);

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
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        className="fixed top-3 left-3 z-50 lg:hidden size-9 rounded-lg bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors"
      >
        <HugeiconsIcon icon={Menu01Icon} className="size-4 text-muted-foreground" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — mobile overlay on small screens, static sidebar on desktop */}
      <aside
        className={cn(
          'flex-col bg-sidebar border-r border-sidebar-border/60 transition-all duration-300 select-none',
          mobileOpen
            ? 'fixed inset-y-0 left-0 z-50 w-[260px] shadow-2xl flex'
            : 'hidden',
          'lg:flex lg:static lg:shadow-none lg:z-30',
          collapsed ? 'lg:w-[64px]' : 'lg:w-[260px]'
        )}
      >
        {/* Brand + collapse toggle */}
        <div className={cn(
          'flex shrink-0',
          collapsed ? 'flex-col items-center gap-1.5 py-2' : 'items-center h-14 px-4'
        )}>
          <div className="size-7 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={Hospital01Icon} className="size-3.5 text-white" />
          </div>
          {!collapsed && (
            <>
              <span className="text-sm font-bold text-sidebar-foreground tracking-tight flex-1 ml-2.5">MediPort</span>
              <button
                onClick={() => setCollapsed(true)}
                className="flex items-center justify-center size-7 rounded-md text-sidebar-foreground/25 hover:text-sidebar-foreground/50 hover:bg-sidebar-accent transition-colors"
              >
                <HugeiconsIcon icon={Menu02Icon} className="size-3.5" />
              </button>
            </>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="flex items-center justify-center size-7 rounded-md text-sidebar-foreground/25 hover:text-sidebar-foreground/50 hover:bg-sidebar-accent transition-colors"
            >
              <HugeiconsIcon icon={Menu01Icon} className="size-4" />
            </button>
          )}
        </div>

        {/* Navigation — grouped sections */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-none space-y-5">
          {navGroups.map((group, gi) => (
            <div key={gi} className="space-y-0.5">
              {!collapsed && (
                <div className="px-2.5 pb-1 first:pt-0">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/35">
                    {group.label}
                  </span>
                </div>
              )}
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => { navigate(item.href); setMobileOpen(false); }}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center w-full rounded-md text-sm transition-all duration-150',
                      collapsed ? 'justify-center h-9' : 'gap-3 h-8 px-2.5',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                        : 'text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground/80'
                    )}
                  >
                    <HugeiconsIcon
                      icon={item.icon}
                      className={cn(
                        'size-[18px] shrink-0 transition-colors',
                        isActive ? 'text-sidebar-foreground/80' : 'text-sidebar-foreground/35'
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer — profile + theme */}
        <div className="border-t border-sidebar-border/60 shrink-0">
          {/* Profile */}
          <div className="relative px-2 pt-2 pb-1">
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
              <div className="absolute bottom-full left-2 right-2 mb-1 bg-card rounded-lg shadow-lg shadow-border border border-sidebar-border/60 overflow-hidden z-50">
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

          {/* Theme mode — bottom of sidebar */}
          {!collapsed && (
            <div className="border-t border-sidebar-border/40 px-2 py-1.5">
              <div className="flex items-center justify-center gap-0.5">
                {([['light', '☀️'], ['system', '🖥️'], ['dark', '🌙']] as const).map(([mode, icon]) => (
                  <button
                    key={mode}
                    onClick={() => setTheme(mode)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-xs font-medium transition-all',
                      theme === mode
                        ? 'bg-sidebar-accent text-sidebar-foreground/80 shadow-sm'
                        : 'text-sidebar-foreground/30 hover:text-sidebar-foreground/50 hover:bg-sidebar-accent/50'
                    )}
                    aria-label={`${mode} mode`}
                  >
                    <span className="text-[11px]">{icon}</span>
                    <span className="capitalize">{mode}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {collapsed && (
            <div className="px-2 py-1.5 flex justify-center">
              <button
                onClick={() => {
                  const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
                  const idx = modes.indexOf(theme);
                  setTheme(modes[(idx + 1) % 3]);
                }}
                className="size-7 rounded-md flex items-center justify-center text-sidebar-foreground/30 hover:text-sidebar-foreground/50 hover:bg-sidebar-accent transition-colors"
                aria-label={`Current: ${theme} mode. Click to change.`}
              >
                <span className="text-xs">
                  {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '🖥️'}
                </span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <RefreshProvider>
          <RefreshIndicator />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className={containerClass}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </RefreshProvider>
      </main>
    </div>
  );
}
