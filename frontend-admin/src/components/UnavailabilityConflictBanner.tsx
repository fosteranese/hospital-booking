import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, ArrowRight01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

export function UnavailabilityConflictBanner() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [total, setTotal] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const profile: any = await api.getProfile(token);
        if (!profile.doctor_id) { setLoading(false); return; }
        const { total_conflicts } = await api.getUnavailabilityConflictSummary(profile.doctor_id, token);
        setTotal(total_conflicts);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading || dismissed || total === 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-5 py-3.5 rounded-lg ring-1 ring-red-200/60 dark:ring-red-900/60">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
        <span>There {total === 1 ? 'is' : 'are'} <strong>{total}</strong> appointment{total !== 1 ? 's' : ''} with scheduling conflicts due to unavailability.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={() => navigate('/dashboard/conflicts')}>
          View Conflicts
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
        </Button>
        <button onClick={() => setDismissed(true)} className="p-1.5 rounded-lg text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>
    </div>
  );
}
