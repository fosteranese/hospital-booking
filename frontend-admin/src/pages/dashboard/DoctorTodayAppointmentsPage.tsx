import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useContentContainer } from '@/pages/dashboard/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar01Icon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  Mail01Icon,
  CallIcon,
} from '@hugeicons/core-free-icons';


function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
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

function StatusDot({ status, attended, minutes_late }: { status: string; attended: boolean | null; minutes_late: number | null }) {
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
        <div className="size-2 rounded-full bg-red-500 shrink-0" />
        <span className="text-xs text-red-600 font-medium">Missed</span>
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

function AppointmentSlidePanel({
  appointment,
  onClose,
  onMarkAttendance,
}: {
  appointment: AppointmentHistoryItem;
  onClose: () => void;
  onMarkAttendance: (id: string, attended: boolean, minutes?: number) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 200);
  };

  const isAttended = appointment.attended === true;
  const isMissed = appointment.attended === false;
  const isCancelled = appointment.status === 'cancelled';
  const isPending = !isAttended && !isMissed && !isCancelled;

  function statusInfo() {
    if (isAttended) return { label: `Attended${appointment.minutes_late ? ` · ${appointment.minutes_late}m late` : ''}`, dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
    if (isMissed) return { label: 'Missed', dot: 'bg-red-500', bar: 'bg-red-500' };
    if (isCancelled) return { label: 'Cancelled', dot: 'bg-slate-300', bar: 'bg-slate-300' };
    return { label: 'Pending', dot: 'bg-amber-400', bar: 'bg-amber-400' };
  }

  const status = statusInfo();

  const animateClass = visible ? 'opacity-100' : 'opacity-0';
  const slideClass = visible ? 'translate-x-0' : 'translate-x-full';

  return (
    <>
      <div className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ease-out lg:hidden ${animateClass}`} onClick={handleClose} />
      <div className={`fixed top-0 right-0 h-full w-full lg:w-[520px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out ${slideClass}`}>
        <div className={`h-1 shrink-0 ${status.bar}`} />

        <div className="flex items-center justify-between px-7 pt-5 pb-2 shrink-0">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-[0.12em]">Appointment Details</div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-7 pb-6">
          <div className="flex items-center gap-5 pt-4 pb-7 border-b border-slate-100">
            <div className="size-14 rounded-full bg-slate-100 flex items-center justify-center text-xl font-bold text-slate-600 shrink-0 shadow-sm">
              {(appointment.patient_name || 'P').split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')}
            </div>
            <div className="min-w-0">
              <div className="text-xl font-bold text-slate-900 truncate">{appointment.patient_name || 'Patient'}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`size-1.5 rounded-full ${status.dot}`} />
                <span className="text-sm text-slate-500">{status.label}</span>
              </div>
              <a href={`mailto:${appointment.patient_email}`} className="flex items-center gap-1.5 mt-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors group">
                <HugeiconsIcon icon={Mail01Icon} className="size-3.5 shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" />
                <span className="truncate">{appointment.patient_email}</span>
              </a>
              <a href={`tel:${appointment.patient_phone}`} className="flex items-center gap-1.5 mt-0.5 text-sm text-slate-500 hover:text-amber-600 transition-colors group">
                <HugeiconsIcon icon={CallIcon} className="size-3.5 shrink-0 text-slate-400 group-hover:text-amber-500 transition-colors" />
                <span>{appointment.patient_phone || '—'}</span>
              </a>
            </div>
          </div>

          <div className="py-6 border-b border-slate-100">
            <div className="grid grid-cols-2 gap-y-5 gap-x-8">
              <div>
                <div className="text-xs font-medium text-slate-400 mb-1">Date</div>
                <div className="text-sm font-semibold text-slate-900">
                  {new Date(appointment.slot_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400 mb-1">Time</div>
                <div className="text-sm font-semibold text-slate-900">{formatTime(appointment.start_time)} — {formatTime(appointment.end_time)}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400 mb-1">Doctor</div>
                <div className="text-sm font-semibold text-slate-900">Dr. {appointment.doctor_name}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400 mb-1">Specialization</div>
                <div className="text-sm font-semibold text-slate-900">{appointment.specialization}</div>
              </div>
            </div>
          </div>

          {appointment.notes && (
            <div className="py-6">
              <div className="text-xs font-medium text-slate-400 mb-3">Notes</div>
              <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-4 whitespace-pre-wrap border border-slate-100">
                {appointment.notes}
              </div>
            </div>
          )}

          {appointment.cancellation_reason && (
            <div className="py-6 border-b border-slate-100">
              <div className="text-xs font-medium text-slate-400 mb-3">Cancellation Reason</div>
              <div className="text-sm text-red-600 leading-relaxed bg-red-50 rounded-xl p-4 border border-red-100">
                {appointment.cancellation_reason}
              </div>
            </div>
          )}
        </div>

        {isPending && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-7 py-5">
            <p className="text-xs font-medium text-slate-400 mb-3 text-center">Mark this appointment as:</p>
            <div className="flex gap-3">
              <button
                onClick={() => { onMarkAttendance(appointment.id, true); handleClose(); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors shadow-sm"
              >
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                Attended
              </button>
              <button
                onClick={() => { onMarkAttendance(appointment.id, false); handleClose(); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                Missed
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
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

  const handleAttendance = async (id: string, attended: boolean, minutes?: number) => {
    try {
      await api.markAttendance(id, { attended, minutes_late: minutes }, token);
      setTodayAppts(prev => prev.map(a => a.id === id ? { ...a, attended, status: 'confirmed' } : a));
    } catch (e: any) {
      setTodayError(e.message);
    }
  };

  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('confirmed');
  const { setContainerClass } = useContentContainer();

  useEffect(() => {
    setContainerClass(selectedAppointment
      ? 'max-w-[2000px] lg:max-w-[calc(80rem+440px)] mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200'
      : 'max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
    return () => setContainerClass('max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
  }, [selectedAppointment, setContainerClass]);

  const statuses = [
    { key: 'confirmed', label: 'Pending', color: 'bg-amber-400' },
    { key: 'attended', label: 'Attended', color: 'bg-emerald-500' },
    { key: 'missed', label: 'Missed', color: 'bg-red-500' },
    { key: 'cancelled', label: 'Cancelled', color: 'bg-slate-300' },
    { key: 'all', label: `All (${todayAppts.length})`, color: '' },
  ];

  const filtered = todayAppts.filter(a => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'confirmed') return a.status !== 'cancelled' && a.attended === null;
    if (statusFilter === 'attended') return a.attended === true;
    if (statusFilter === 'missed') return a.attended === false;
    if (statusFilter === 'cancelled') return a.status === 'cancelled';
    return true;
  });

  return (
    <div className={`space-y-6 transition-all duration-200 ${
      selectedAppointment ? 'lg:mr-[520px] px-8' : ''
    }`}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Today's Appointments"
          description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          icon={Calendar01Icon}
        />
        <div className="flex items-center gap-1 shrink-0 pt-1">
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

      {todayError && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {todayError}
        </div>
      )}

      <Card padding="none">
        {todayLoading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Calendar01Icon}
            title="No appointments"
            description="No appointments match the selected filter."
          />
        ) : (
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <tbody>
              {filtered
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map(a => {
                  const isAttended = a.attended === true;
                  const isMissed = a.attended === false;
                  const isCancelled = a.status === 'cancelled';
                  const isPending = !isAttended && !isMissed && !isCancelled;
                  const borderColor = isAttended ? '#10b981' : isMissed ? '#ef4444' : isCancelled ? '#cbd5e1' : '#f59e0b';

                  return (
                    <tr
                      key={a.id}
                      className="cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md group"
                      onClick={() => setSelectedAppointment(a)}
                      style={{ transformOrigin: 'center left' }}
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
                        <div className="text-base font-medium text-slate-900 truncate">{a.patient_name || 'Patient'}</div>
                        {a.notes && <div className="text-xs text-slate-400 truncate mt-0.5">{a.notes}</div>}
                      </td>
                      <td className="w-[100px] py-4 border-b border-slate-100 align-top"><StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} /></td>
                      <td className="pr-3 w-0 py-4 border-b border-slate-100 align-top">
                        {isPending ? (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={e => { e.stopPropagation(); handleAttendance(a.id, true); }}
                              className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
                              title="Mark attended"
                            >
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleAttendance(a.id, false); }}
                              className="p-1.5 rounded-md text-red-400 hover:bg-red-50 transition-colors"
                              title="Mark missed"
                            >
                              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedAppointment(a); }}
                              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                            >
                              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedAppointment(a); }}
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
        )}
      </Card>

      {selectedAppointment && (
        <AppointmentSlidePanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onMarkAttendance={handleAttendance}
        />
      )}
    </div>
  );
}
