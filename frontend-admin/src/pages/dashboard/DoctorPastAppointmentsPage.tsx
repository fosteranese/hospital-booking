import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, AlertCircleIcon, CheckmarkCircle01Icon, Cancel01Icon, ArrowRight01Icon, Search01Icon, Clock01Icon } from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function StatusDot({ status, attended }: { status: string; attended: boolean | null }) {
  if (attended === true) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-600 font-medium">Attended</span>
      </div>
    );
  }
  if (attended === false) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-purple-500 shrink-0" />
        <span className="text-xs text-purple-600 font-medium">Missed</span>
      </div>
    );
  }
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-slate-300 shrink-0" />
        <span className="text-xs text-slate-400 font-medium">Cancelled</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="size-2 rounded-full bg-amber-400 shrink-0" />
      <span className="text-xs text-amber-600 font-medium">Confirmed</span>
    </div>
  );
}

export function DoctorPastAppointmentsPage() {
  const { token } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchPastAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAppointments({ to: today }, token);
      setAppointments(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [token, today]);

  useEffect(() => { fetchPastAppointments(); }, [fetchPastAppointments]);

  const statuses = [
    { key: 'attended', label: 'Attended', color: 'bg-emerald-500' },
    { key: 'missed', label: 'Missed', color: 'bg-purple-500' },
    { key: 'cancelled', label: 'Cancelled', color: 'bg-slate-300' },
    { key: 'all', label: 'All', color: '' },
  ] as const;

  const [statusFilter, setStatusFilter] = useState('all');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Past Appointments"
        description="View appointment history"
        icon={Clock01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center h-12 w-full max-w-[340px] rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all shadow-sm">
          <div className="shrink-0 text-slate-400 ml-3">
            <HugeiconsIcon icon={Search01Icon} className="size-4" />
          </div>
          <input
            type="text"
            placeholder="Search by patient name or reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 h-full pl-3 pr-3 text-sm bg-transparent focus:outline-none min-w-0 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="shrink-0 mr-1.5 p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {statuses.map(s => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === s.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {s.color && <div className={`size-1.5 rounded-full ${s.color}`} />}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState icon={Calendar01Icon} title="No past appointments" description="No past appointments found." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                {appointments
                  .filter(a => statusFilter === 'all' || (statusFilter === 'attended' && a.attended === true) || (statusFilter === 'missed' && a.attended === false) || (statusFilter === 'cancelled' && a.status === 'cancelled'))
                  .filter(a => !searchQuery.trim() || (a.patient_name && a.patient_name.toLowerCase().includes(searchQuery.toLowerCase())) || (a.notes && a.notes.toLowerCase().includes(searchQuery.toLowerCase())))
                  .sort((a, b) => b.slot_date.localeCompare(a.slot_date) || b.start_time.localeCompare(a.start_time))
                  .map(a => {
                    const borderColor = a.attended === true ? '#10b981' : a.attended === false ? '#9333ea' : a.status === 'cancelled' ? '#cbd5e1' : '#f59e0b';
                    return (
                      <tr key={a.id} className="transition-all duration-150 hover:bg-slate-50/80 group last:[&>td]:border-b-0" style={{ transformOrigin: 'center' }}>
                        <td className="py-4 w-[120px] border-b border-slate-100 align-top px-5 whitespace-nowrap" style={{ borderLeft: `3px solid ${borderColor}` }}>
                          <div className="text-sm font-semibold text-slate-900">{new Date(a.slot_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{formatTime(a.start_time)} — {formatTime(a.end_time)}</div>
                        </td>
                        <td className="py-4 border-b border-slate-100 align-top px-5">
                          <div className="text-sm font-medium text-slate-900">{a.patient_name || 'Patient'}</div>
                          <div className="text-xs text-slate-400">Dr. {a.doctor_name}</div>
                        </td>
                        <td className="py-4 border-b border-slate-100 align-top px-5">
                          <StatusDot status={a.status} attended={a.attended} />
                        </td>
                        {a.notes && (
                          <td className="py-4 border-b border-slate-100 align-top px-5 max-w-[200px]">
                            <div className="text-xs text-slate-500 truncate">{a.notes}</div>
                          </td>
                        )}
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
