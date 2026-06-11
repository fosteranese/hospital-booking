import { useState, useEffect, useCallback } from 'react';
import { useCachedData } from '@/hooks/useCachedData';
import { api, AppointmentHistoryItem, Doctor } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { AppointmentDetailModal } from '@/components/AppointmentDetailModal';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  AlertCircleIcon,
  TimeScheduleIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function getEffectiveStatus(a: AppointmentHistoryItem): 'attended' | 'missed' | 'confirmed' | 'cancelled' {
  if (a.status === 'cancelled') return 'cancelled';
  if (a.attended === true) return 'attended';
  if (a.attended === false) return 'missed';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const apptDate = new Date(a.slot_date + 'T00:00:00');
  if (apptDate < today) return 'missed';
  const [h, m] = a.end_time.split(':').map(Number);
  const slotEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m);
  if (new Date() >= slotEnd) return 'missed';
  return 'confirmed';
}

function StatusDot({ status, attended, minutes_late, arrival_time, start_time, has_conflict }: { status: string; attended: boolean | null; minutes_late: number | null; arrival_time?: string | null; start_time?: string; has_conflict?: boolean }) {
  if (has_conflict) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium">
        <span className="size-1.5 rounded-full bg-red-600" />
        Conflict
      </span>
    );
  }
  const effective = getEffectiveStatus({ status, attended, end_time: '', minutes_late } as AppointmentHistoryItem);
  const map: Record<string, { label: string; color: string }> = {
    attended:  { label: 'Attended',  color: 'bg-emerald-500' },
    missed:    { label: 'Missed',    color: 'bg-purple-500' },
    cancelled: { label: 'Cancelled', color: 'bg-slate-300' },
    confirmed: { label: 'Confirmed', color: 'bg-blue-500' },
  };
  const s = map[effective];
  const arrivalDisplay = (() => {
    if (arrival_time) {
      const timePart = arrival_time.split('T')[1]?.slice(0, 5);
      if (timePart) return formatTime(timePart);
    }
    if (attended === true && minutes_late != null && minutes_late > 0 && start_time) {
      const [h, m] = start_time.split(':').map(Number);
      const totalMin = h * 60 + m + minutes_late;
      const newH = Math.floor(totalMin / 60) % 24;
      const newM = totalMin % 60;
      return `${newH % 12 || 12}:${String(newM).padStart(2, '0')} ${newH >= 12 ? 'PM' : 'AM'}`;
    }
    return null;
  })();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`size-1.5 rounded-full ${s.color}`} />
      {s.label}
      {arrivalDisplay && (
        <span className="text-amber-600 font-medium">· arrived {arrivalDisplay}</span>
      )}
    </span>
  );
}

function PatientAvatar({ name }: { name: string }) {
  const initial = (name || 'P').charAt(0).toUpperCase();
  return (
    <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-xs font-semibold text-slate-600">
      {initial}
    </div>
  );
}

function TodayStatCard({
  label,
  value,
  total,
  cardBg,
  borderClass,
}: {
  label: string;
  value: number;
  total: number;
  cardBg: string;
  borderClass: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`relative overflow-hidden rounded-xl border ${cardBg} ${borderClass}`}>
      <div className="py-5 px-5">
        <div className="text-[32px] font-bold text-white tracking-tight leading-none">{value}</div>
        <div className="text-sm text-white/70 font-medium mt-1.5">{label}</div>
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white/60 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionsBar({ pendingCount, onMarkAttendance }: { pendingCount: number; onMarkAttendance: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onMarkAttendance}
        disabled={pendingCount === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5" />
        Mark Attendance
      </button>
      <span className="text-[11px] text-slate-400">{pendingCount} pending</span>
    </div>
  );
}

export function TodayPage() {
  const { token } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [latenessInput, setLatenessInput] = useState<{ id: string; arrivalTime: string } | null>(null);

  const cacheKey = `appointments:today:${today}:${selectedDoctor || 'all'}`;

  const { data: raw, loading, error, refresh: fetchAppointments, backgroundRefresh } = useCachedData(
    cacheKey,
    useCallback(async () => {
      const params: { date: string; doctor_id?: string } = { date: today };
      if (selectedDoctor) params.doctor_id = selectedDoctor;
      return await api.listAppointments(params, token);
    }, [token, today, selectedDoctor]),
    { enabled: !!token }
  );
  const appointments = raw ?? [];

  const fetchDoctors = useCallback(async () => {
    try {
      const data = await api.getDoctors();
      setDoctors(data);
    } catch {
    }
  }, []);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const refreshAll = useCallback(() => {
    backgroundRefresh();
  }, [backgroundRefresh]);

  const handleConfirmAttend = useCallback(async (id: string, attended: boolean, arrivalTime?: string | null) => {
    try {
      const arrivalIso = arrivalTime ? `${today}T${arrivalTime}:00` : `${today}T00:00:00`;
      await api.markAttendance(id, { attended, arrival_time: arrivalIso }, token);
      setLatenessInput(null);
      refreshAll();
    } catch (e: any) {
      console.error(e.message || 'Failed to update attendance');
    }
  }, [token, fetchAppointments, today]);

  const pendingToday = appointments.filter(a => getEffectiveStatus(a) === 'confirmed').length;
  const attendedToday = appointments.filter(a => getEffectiveStatus(a) === 'attended').length;
  const missedToday = appointments.filter(a => getEffectiveStatus(a) === 'missed').length;
  const totalToday = pendingToday + attendedToday + missedToday;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Today's Appointments"
          description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          icon={Calendar01Icon}
        />
        <button onClick={refreshAll} className="w-12 h-12 flex items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all shrink-0" title="Refresh data">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5 text-slate-500">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
        <select
          value={selectedDoctor}
          onChange={e => setSelectedDoctor(e.target.value)}
          className="h-9 text-xs border border-slate-200 rounded-lg px-3 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-400 appearance-none cursor-pointer"
        >
          <option value="">All Doctors</option>
          {doctors.map(d => (
            <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3.5 py-2.5 rounded-lg">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {!loading && (
        <QuickActionsBar
          pendingCount={pendingToday}
          onMarkAttendance={() => {
            const firstPending = appointments.find(a => getEffectiveStatus(a) === 'confirmed');
            if (firstPending) setSelectedAppointmentId(firstPending.id);
          }}
        />
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {['Pending', 'Attended', 'Missed', 'Total'].map((label, i) => {
          const colors = [
            { value: pendingToday, bg: 'bg-amber-500', border: 'border-amber-700' },
            { value: attendedToday, bg: 'bg-emerald-500', border: 'border-emerald-700' },
            { value: missedToday, bg: 'bg-purple-500', border: 'border-purple-700' },
            { value: totalToday, bg: 'bg-slate-600', border: 'border-slate-700' },
          ][i];
          if (loading) {
            return <div key={label} className="h-[108px] bg-slate-100 rounded-lg animate-pulse" />;
          }
          return (
            <TodayStatCard
              key={label}
              label={`${label} Today`}
              value={colors.value}
              total={totalToday}
              cardBg={colors.bg}
              borderClass={colors.border}
            />
          );
        })}
      </div>

      {/* Schedule */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon icon={TimeScheduleIcon} className="size-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Schedule</h3>
        </div>
        <Card padding="none">
          {loading ? (
            <div className="p-5 space-y-2.5">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-md animate-pulse" />)}
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState
              icon={Calendar01Icon}
              title="No appointments today"
              description={selectedDoctor ? 'This doctor has no appointments scheduled for today.' : 'There are no appointments scheduled for today.'}
            />
          ) : (
            <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                {appointments
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map(a => {
                    const effective = getEffectiveStatus(a);
                    const isAttended = effective === 'attended';
                    const isMissed = effective === 'missed';
                    const isCancelled = effective === 'cancelled';
                    const isPending = effective === 'confirmed';
                    const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : isCancelled ? '#cbd5e1' : '#f59e0b';
                    const isEditingLatness = latenessInput?.id === a.id;

                    const autoArrivalTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                    return (
                      <tr
                        key={a.id}
                        className="cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md group border-b border-slate-100 last:border-b-0"
                        onClick={() => setSelectedAppointmentId(a.id)}
                        style={{ transformOrigin: 'center' }}
                      >
                        <td className="pl-4 py-3" style={{ borderLeft: `4px solid ${borderColor}` }}>
                          <PatientAvatar name={a.patient_name} />
                        </td>
                        <td className="py-3 w-[56px]">
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-semibold text-slate-900">{formatTime(a.start_time)}</span>
                            <span className="text-[10px] text-slate-400">{formatTime(a.end_time)}</span>
                          </div>
                        </td>
                        <td className="w-px"><div className="h-8 bg-slate-100 w-px" /></td>
                        <td className="min-w-0 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="text-sm font-medium text-slate-900 truncate">{a.patient_name || 'Patient'}</div>
                            {a.referring_doctor_id && (
                              <span title={a.referring_doctor_name ? `Referred by Dr. ${a.referring_doctor_name}` : 'Referred by another doctor'}>
                                <HugeiconsIcon icon={UserGroupIcon} className="size-3.5 text-violet-500 shrink-0" />
                              </span>
                            )}
                            {a.referring_doctor_name && <span className="text-xs text-violet-400 ml-0.5">(ref. Dr. {a.referring_doctor_name})</span>}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">{a.doctor_name}</div>
                          {a.notes && <div className="text-xs text-slate-400 truncate mt-0.5">{a.notes}</div>}
                        </td>
                        <td className="w-[144px] py-3"><StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} arrival_time={a.arrival_time} start_time={a.start_time} has_conflict={a.has_conflict} /></td>
                        <td className="pr-3 w-0 py-3">
                          {isEditingLatness ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-500 whitespace-nowrap">Arrival:</span>
                              <input
                                type="time"
                                className="w-24 h-7 text-xs text-center border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                value={latenessInput.arrivalTime}
                                onChange={e => setLatenessInput({ ...latenessInput, arrivalTime: e.target.value })}
                                autoFocus
                              />
                              <button
                                onClick={e => { e.stopPropagation(); handleConfirmAttend(a.id, true, latenessInput.arrivalTime); }}
                                className="p-1 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
                                title="Confirm"
                              >
                                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                              </button>
                              <button
                                onClick={() => setLatenessInput(null)}
                                className="p-1 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                                title="Cancel"
                              >
                                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={e => e.stopPropagation()}
                            >
                              {isPending && (
                                <>
                                  <button
                                    onClick={e => { e.stopPropagation(); setLatenessInput({ id: a.id, arrivalTime: autoArrivalTime }); }}
                                    className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
                                    title="Mark attended"
                                  >
                                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                                  </button>
                                  <button
                                    onClick={() => handleConfirmAttend(a.id, false, autoArrivalTime)}
                                    className="p-1.5 rounded-md text-red-400 hover:bg-red-50 transition-colors"
                                    title="Mark missed"
                                  >
                                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setSelectedAppointmentId(a.id)}
                                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                              >
                                <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                              </button>
                            </div>
                          )}
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

      {selectedAppointmentId && (
        <AppointmentDetailModal
          appointmentId={selectedAppointmentId}
          onClose={() => setSelectedAppointmentId(null)}
          onUpdated={() => refreshAll()}
        />
      )}
    </div>
  );
}
