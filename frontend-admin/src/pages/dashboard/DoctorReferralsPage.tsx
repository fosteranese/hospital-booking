import { useState, useEffect } from 'react';
import { api, ReferralItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, AlertCircleIcon, Calendar01Icon, CheckmarkCircle01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusLabel(a: ReferralItem): { label: string; color: string } {
  if (a.status === 'cancelled') return { label: 'Cancelled', color: 'bg-slate-300' };
  if (a.attended === true) return { label: 'Attended', color: 'bg-emerald-500' };
  if (a.attended === false) return { label: 'Missed', color: 'bg-purple-500' };
  return { label: 'Confirmed', color: 'bg-amber-400' };
}

export function DoctorReferralsPage() {
  const { token } = useAuth();
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getReferrals(token);
        setReferrals(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Referrals"
        description="Appointments referred by doctors to other practitioners"
        icon={ArrowRight01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : referrals.length === 0 ? (
          <EmptyState
            icon={CheckmarkCircle01Icon}
            title="No referrals"
            description="No doctor referrals have been made yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                {referrals.map((r) => {
                  const status = getStatusLabel(r);
                  return (
                    <tr key={r.id} className="transition-all duration-150 hover:bg-slate-50/80 group last:[&>td]:border-b-0" style={{ transformOrigin: 'center' }}>
                      <td className="py-4 border-b border-slate-100 align-top px-5 whitespace-nowrap" style={{ borderLeft: `3px solid ${status.color.includes('emerald') ? '#10b981' : status.color.includes('purple') ? '#9333ea' : status.color.includes('amber') ? '#f59e0b' : '#cbd5e1'}` }}>
                        <div className="text-sm font-semibold text-slate-900">{r.patient_name}</div>
                        <div className="text-xs text-slate-400">{formatDate(r.slot_date)} · {formatTime(r.start_time)} — {formatTime(r.end_time)}</div>
                      </td>
                      <td className="py-4 border-b border-slate-100 align-top px-5">
                        <div className="text-sm text-slate-500">
                          <span className="text-xs text-slate-400 uppercase tracking-wider">Referred by</span>
                          <div className="text-sm font-medium text-slate-900">{r.referring_doctor_name}</div>
                        </div>
                      </td>
                      <td className="py-4 border-b border-slate-100 align-top px-5">
                        <div className="text-sm text-slate-500">
                          <span className="text-xs text-slate-400 uppercase tracking-wider">To</span>
                          <div className="text-sm font-medium text-slate-900">{r.doctor_name}</div>
                        </div>
                      </td>
                      <td className="py-4 border-b border-slate-100 align-top px-5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          status.color === 'bg-emerald-500' ? 'text-emerald-700 bg-emerald-50' :
                          status.color === 'bg-purple-500' ? 'text-purple-700 bg-purple-50' :
                          status.color === 'bg-amber-400' ? 'text-amber-700 bg-amber-50' :
                          'text-slate-400 bg-slate-50'
                        }`}>
                          <span className={`size-1.5 rounded-full ${status.color}`} />
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
