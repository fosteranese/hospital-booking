import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useContentContainer } from '@/pages/dashboard/DashboardLayout';
import { useCachedData } from '@/hooks/useCachedData';


import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { AppointmentSlidePanel } from '@/components/AppointmentSlidePanel';
import { RescheduleModal } from '@/components/RescheduleModal';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlertCircleIcon,
  Calendar01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  UserGroupIcon,
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

function StatusDot({ status, attended, minutes_late, start_time, arrival_time, slot_date, has_conflict }: { status: string; attended: boolean | null; minutes_late: number | null; start_time?: string; arrival_time?: string | null; slot_date?: string; has_conflict?: boolean }) {
  if (has_conflict) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-red-500 shrink-0" />
        <span className="text-xs text-red-600 font-medium">Conflict</span>
      </div>
    );
  }
  if (attended === true) {
    const arrivalDisplay = (() => {
      if (arrival_time) {
        const timePart = arrival_time.split('T')[1]?.slice(0, 5);
        if (timePart) return timePart;
      }
      if (minutes_late != null && minutes_late > 0 && start_time) {
        const [h, m] = start_time.split(':').map(Number);
        const totalMin = h * 60 + m + minutes_late;
        const newH = Math.floor(totalMin / 60) % 24;
        const newM = totalMin % 60;
        return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
      }
      return null;
    })();
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-600 font-medium">
          Attended{arrivalDisplay ? ` · arrived ${formatTime(arrivalDisplay)}` : ''}
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
  if (slot_date && (() => { const t = new Date(); t.setHours(0,0,0,0); return new Date(slot_date + 'T00:00:00') < t; })()) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-purple-500 shrink-0" />
        <span className="text-xs text-purple-600 font-medium">Missed</span>
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



export function DoctorConflictsPage() {
  const { token } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const profile: any = await api.getProfile(token);
        if (profile.doctor_id) setDoctorId(profile.doctor_id);
      } catch { /* ignore */ }
    })();
  }, [token]);

  const { data: raw, loading, error, refresh: fetchConflicts, backgroundRefresh } = useCachedData(
    doctorId ? `appointments:conflicts:${doctorId}` : null,
    useCallback(async () => {
      const data = await api.listAppointments({ doctor_id: doctorId! }, token);
      return data.filter(a => a.has_conflict);
    }, [doctorId, token]),
    { enabled: !!doctorId }
  );
  const appointments = raw ?? [];
  const refreshAll = useCallback(() => {
    backgroundRefresh();
  }, [backgroundRefresh]);

  const { setContainerClass } = useContentContainer();

  useEffect(() => {
    setContainerClass(selectedAppointment
      ? 'max-w-[2000px] lg:max-w-[calc(80rem+480px)] mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200'
      : 'max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
    return () => setContainerClass('max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
  }, [selectedAppointment, setContainerClass]);

  const handleResolved = () => {
    refreshAll();
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
    <div className={`space-y-6 transition-[margin-right] duration-200 ${selectedAppointment ? 'lg:mr-[480px]' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Appointment Conflicts"
          description={`${appointments.length} appointment${appointments.length !== 1 ? 's' : ''} with scheduling conflicts`}
          icon={AlertCircleIcon}
        />
        <div className="flex items-center gap-2 shrink-0 self-start pt-1">
          <button onClick={refreshAll} className="w-12 h-12 flex items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all" title="Refresh data">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5 text-slate-500">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
      </div>

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
                  <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <tbody>
                      {rows.map(a => {
                        const isAttended = a.attended === true;
                        const isMissed = a.attended === false;
                        const isPending = !isAttended && !isMissed;
                        const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : '#ef4444';

                        return (
                          <tr
                            key={a.id}
                             className="cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0 transform-gpu"
                            style={{ transformOrigin: 'center' }}
                            onClick={() => setSelectedAppointment(a)}
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
                                {a.referring_doctor_id && (
                                  <span title={a.referring_doctor_name ? `Referred by Dr. ${a.referring_doctor_name}` : 'Referred by another doctor'}>
                                    <HugeiconsIcon icon={UserGroupIcon} className="size-3.5 text-violet-500 shrink-0" />
                                  </span>
                                )}
                                {a.referring_doctor_name && <span className="text-xs text-violet-400 ml-0.5">(ref. Dr. {a.referring_doctor_name})</span>}
                              </div>
                              {a.notes && <div className="text-xs text-slate-400 truncate mt-0.5">{a.notes}</div>}
                            </td>
                            <td className="w-[100px] py-4 border-b border-slate-100 align-top">
                              <StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} start_time={a.start_time} arrival_time={a.arrival_time} slot_date={a.slot_date} has_conflict={a.has_conflict} />
                            </td>
                            <td className="pr-3 w-0 py-4 border-b border-slate-100 align-top">
                              <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={e => e.stopPropagation()}
                              >
                                {isPending && (
                                  <button
                                    onClick={() => setRescheduleTarget(a)}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors"
                                  >
                                    <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5" />
                                    Reschedule
                                  </button>
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
              </div>
            );
          })}
        </div>
      )}

      <RescheduleModal
        open={!!rescheduleTarget}
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onResolved={handleResolved}
      />

      {selectedAppointment && (
        <AppointmentSlidePanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onRequestAttendance={() => {}}
          onReschedule={setRescheduleTarget}
        />
      )}
    </div>
  );
}
