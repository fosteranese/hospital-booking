import { useNavigate, useLocation } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Hospital01Icon, Calendar01Icon, Settings01Icon, Clock01Icon, Logout01Icon, DashboardSquare01Icon } from '@hugeicons/core-free-icons';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

const roleNav = {
  admin: [
    { label: 'Appointments', href: '/dashboard', icon: Calendar01Icon },
    { label: 'Unavailability', href: '/dashboard/unavailability', icon: Clock01Icon },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings01Icon },
  ],
  scheduler: [
    { label: 'Appointments', href: '/dashboard', icon: Calendar01Icon },
    { label: 'Unavailability', href: '/dashboard/unavailability', icon: Clock01Icon },
  ],
  doctor: [
    { label: 'Today', href: '/dashboard', icon: DashboardSquare01Icon },
  ],
} as const;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userRole, clearAuth, otpIdentifier } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = (userRole in roleNav ? userRole : 'admin') as keyof typeof roleNav;
  const navItems = roleNav[role];
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const handleSignOut = () => {
    clearAuth();
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col">
        <div className="flex items-center gap-3 px-5 h-14 border-b border-border shrink-0">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
            <HugeiconsIcon icon={Hospital01Icon} className="size-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold tracking-tight">Dashboard</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <button
                key={item.href}
                onClick={() => navigate(item.href)}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <HugeiconsIcon icon={item.icon} className="size-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
              {roleLabel[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{otpIdentifier}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{roleLabel}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <HugeiconsIcon icon={Logout01Icon} className="size-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
