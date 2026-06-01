import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar01Icon,
  Clock01Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function StatusBadge({ status, attended }: { status: string; attended: boolean | null }) {
  if (attended === true) return <Badge variant="success">Attended</Badge>;
  if (attended === false) return <Badge variant="danger">Missed</Badge>;
  if (status === 'cancelled') return <Badge variant="neutral">Cancelled</Badge>;
  return <Badge variant="info">Confirmed</Badge>;
}

export function DoctorTodayAppointmentsPage() {
  const { token } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [todayAppts, setTodayAppts] = useState<AppointmentHistoryItem[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState('');

  const fetchToday = useCallback(async () => {
    setTodayLoading(true);
    try {
      const data = await api.listAppointments({ date: today }, token);
      setTodayAppts(data);
    } catch (e: any) {
      setTodayError(e.message);
    } finally {
      setTodayLoading(false);
    }
  }, [token, today]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const handleAttendance = async (id: string, attended: boolean) => {
    try {
      await api.markAttendance(id, { attended }, token);
      setTodayAppts(prev => prev.map(a => a.id === id ? { ...a, attended, status: 'confirmed' } : a));
    } catch (e: any) {
      setTodayError(e.message);
    }
  };

  const confirmed = todayAppts.filter(a => a.status !== 'cancelled');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Today's Appointments"
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        icon={Calendar01Icon}
      />

      {todayError && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {todayError}
        </div>
      )}

      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100">
          <CardHeader title={`Today's Appointments (${confirmed.length})`} />
        </div>
        {todayLoading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : confirmed.length === 0 ? (
          <EmptyState
            icon={Calendar01Icon}
            title="No appointments today"
            description="You have no scheduled appointments for today."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Time</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Patient</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Notes</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {confirmed.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                        <HugeiconsIcon icon={Clock01Icon} className="size-3.5 text-slate-400" />
                        {formatTime(a.start_time)} – {formatTime(a.end_time)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{a.doctor_name}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[180px] truncate">{a.notes || '—'}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={a.status} attended={a.attended} /></td>
                    <td className="px-5 py-3.5 text-right">
                      {a.attended === null && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAttendance(a.id, true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                          >
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                            Attended
                          </button>
                          <button
                            onClick={() => handleAttendance(a.id, false)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                            Missed
                          </button>
                        </div>
                      )}
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
