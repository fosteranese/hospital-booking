import { useState, useCallback } from 'react';
import { api, User } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useCachedData } from '@/hooks/useCachedData';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon, AlertCircleIcon } from '@hugeicons/core-free-icons';

const ROLES = ['patient', 'doctor', 'scheduler', 'admin'];

const roleBadgeVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  admin: 'danger',
  scheduler: 'info',
  doctor: 'success',
  patient: 'neutral',
};

export function UsersPage() {
  const { token } = useAuth();
  const { data: usersData, loading, error, backgroundRefresh } = useCachedData(
    'users',
    useCallback(() => api.getUsers(token), [token]),
    { enabled: !!token, staleTime: 120_000 }
  );
  const users = usersData ?? [];
  const [savingId, setSavingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState('');

  const handleRoleChange = async (identifier: string, role: string) => {
    setSavingId(identifier);
    setMutationError('');
    try {
      await api.updateUserRole(identifier, role, token);
      backgroundRefresh();
    } catch (e: any) {
      setMutationError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage user roles and permissions"
        icon={UserGroupIcon}
      />

      {(error || mutationError) && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error || mutationError}
        </div>
      )}

      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            icon={UserGroupIcon}
            title="No users found"
            description="Users will appear here once they register."
          />
        ) : (
          <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">User</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Role</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Change Role</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-5 py-3">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.identifier} className="transition-all duration-150 hover:bg-muted/80 hover:scale-[1.02] hover:shadow-md" style={{ transformOrigin: 'center' }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {u.identifier.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-foreground font-mono">{u.identifier}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={roleBadgeVariant[u.role] || 'default'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.identifier, e.target.value)}
                        disabled={savingId === u.identifier}
                        className="h-8 px-3 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
