import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlertCircleIcon,
  Calendar01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function PatientAvatar({ name }: { name: string }) {
  const initials = (name || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('');
  return (
    <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-[11px] font-semibold text-slate-600">
      {initials}
    </div>
  );
}

function StatusDot({ status, attended, minutes_late, has_conflict }: { status: string; attended: boolean | null; minutes_late: number | null; has_conflict?: boolean }) {
  if (has_conflict) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-red-500 shrink-0" />
        <span className="text-xs text-red-600 font-medium">Conflict</span>
      </div>
    );
  }
  if (attended === true) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-600 font-medium">
          Attended{minutes_late ? ` (${minutes_late}m late)` : ''}
        </span>
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

const inputClass = "h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all";

export function DoctorConflictsPage() {
  const { token } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const profile: any = await api.getProfile(token);
        if (profile.doctor_id) setDoctorId(profile.doctor_id);
      } catch { /* ignore */ }
    })();
  }, [token]);

  const fetchConflicts = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.listAppointments({ doctor_id: doctorId }, token);
      setAppointments(data.filter(a => a.has_conflict));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [doctorId, token]);

  useEffect(() => {
    if (doctorId) fetchConflicts();
  }, [doctorId, fetchConflicts]);

  const handleReschedule = async (id: string) => {
    if (!rescheduleDate || !rescheduleTime) return;
    setRescheduling(id);
    try {
      const [h, m] = rescheduleTime.split(':');
      const endH = String(parseInt(h) + 1).padStart(2, '0');
      await api.rescheduleAppointmentToTime(id, {
        slot_date: rescheduleDate,
        start_time: rescheduleTime,
        end_time: `${endH}:${m}`,
        doctor_id: doctorId!,
      }, token);
      setAppointments(prev => prev.filter(a => a.id !== id));
      setRescheduling(null);
      setRescheduleDate('');
      setRescheduleTime('');
    } catch (e: any) {
      setError(e.message);
      setRescheduling(null);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const isToday = (date: string) => date === today;
  const isTomorrow = (date: string) => date === tomorrow;

  const sorted = [...appointments].sort((a, b) => a.slot_date !== b.slot_date ? a.slot_date.localeCompare(b.slot_date) : a.start_time.localeCompare(b.start_time));

  const groupedByDate = sorted.reduce((acc, a) => {
    if (!acc[a.slot_date]) acc[a.slot_date] = [];
    acc[a.slot_date].push(a);
    return acc;
  }, {} as Record<string, AppointmentHistoryItem[]>);

  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment Conflicts"
        description={`${appointments.length} appointment${appointments.length !== 1 ? 's' : ''} with scheduling conflicts`}
        icon={AlertCircleIcon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={CheckmarkCircle01Icon}
          title="No conflicts"
          description="All appointments are properly scheduled."
        />
      ) : (
        <div className="space-y-4">
          {sortedDates.map(date => {
            const rows = groupedByDate[date];
            return (
              <div key={date} className="rounded-lg">
                <div className="sticky top-0 z-10 bg-background px-5 py-3">
                  <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {isToday(date) ? `Today – ${todayLabel}` : isTomorrow(date) ? `Tomorrow – ${todayLabel}` : formatDate(date)}
                  </span>
                  <span className="ml-2.5 text-xs text-slate-400 font-medium">
                    {rows.length} appointment{rows.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="bg-white rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)]">
                  <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <tbody>
                      {rows.map(a => {
                        const isAttended = a.attended === true;
                        const isMissed = a.attended === false;
                        const isPending = !isAttended && !isMissed;
                        const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : '#ef4444';
                        const isRescheduling = rescheduling === a.id;

                        return (
                          <tr
                            key={a.id}
                            className="cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0"
                            onClick={() => !isRescheduling && setRescheduling(a.id)}
                            style={{ transformOrigin: 'center' }}
                          >
                            <td className="py-4 w-[110px] border-b border-slate-100 align-top pl-4" style={{ borderLeft: `3px solid ${borderColor}` }}>
                              <div className="flex flex-col items-start">
                                <span className="text-base font-semibold text-slate-900">{formatTime(a.start_time)}</span>
                                <span className="text-xs text-slate-400">{formatTime(a.end_time)}</span>
                              </div>
                            </td>
                            <td className="w-10 p-2 border-b border-slate-100 text-center">
                              <PatientAvatar name={a.patient_name} />
                            </td>
                            <td className="min-w-0 py-4 border-b border-slate-100 align-top">
                              <div className="flex items-center gap-1.5">
                                <div className="text-base font-medium text-slate-900 truncate">{a.patient_name || 'Patient'}</div>
                                <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 text-red-500 shrink-0" />
                              </div>
                              {a.notes && <div className="text-xs text-slate-400 truncate mt-0.5">{a.notes}</div>}
                            </td>
                            <td className="w-[100px] py-4 border-b border-slate-100 align-top">
                              <StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} has_conflict={a.has_conflict} />
                            </td>
                            <td className="pr-3 w-0 py-4 border-b border-slate-100 align-top">
                              <div className="flex items-center gap-1 justify-end"
                                onClick={e => e.stopPropagation()}
                              >
                                {isRescheduling ? (
                                  <div className="flex items-center gap-1.5">
                                    <input type="date" value={rescheduleDate} min={today} onChange={e => setRescheduleDate(e.target.value)} className={`${inputClass} w-[130px]`} />
                                    <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className={`${inputClass} w-[100px]`} />
                                    <button
                                      onClick={() => handleReschedule(a.id)}
                                      disabled={!rescheduleDate || !rescheduleTime}
                                      className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="Save"
                                    >
                                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                                    </button>
                                    <button
                                      onClick={() => { setRescheduling(null); setRescheduleDate(''); setRescheduleTime(''); }}
                                      className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                                      title="Cancel"
                                    >
                                      <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isPending && (
                                      <button
                                        onClick={() => setRescheduling(a.id)}
                                        className="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                                        title="Reschedule"
                                      >
                                        <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => setRescheduling(a.id)}
                                      className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                                    >
                                      <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
