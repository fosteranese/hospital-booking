import { useState, useEffect } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { RescheduleModal } from '@/components/RescheduleModal';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Mail01Icon,
  CallIcon,
  AlertCircleIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

const inputClass = "h-8 px-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all";

export function AppointmentSlidePanel({
  appointment,
  onClose,
  onRequestAttendance,
}: {
  appointment: AppointmentHistoryItem;
  onClose: () => void;
  onRequestAttendance: (id: string, attended: boolean) => void;
}) {
  const { token } = useAuth();
  const [visible, setVisible] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setSwitching(true);
    const t = setTimeout(() => setSwitching(false), 300);
    return () => clearTimeout(t);
  }, [appointment.id]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 200);
  };

  const handleResolved = () => {
    onClose();
  };

  const isAttended = appointment.attended === true;
  const isMissed = appointment.attended === false;
  const isCancelled = appointment.status === 'cancelled';
  const isPending = !isAttended && !isMissed && !isCancelled;

  function statusInfo() {
    if (isAttended) return { label: `Attended${appointment.minutes_late ? ` · ${appointment.minutes_late}m late` : ''}`, dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
    if (isMissed) return { label: 'Missed', dot: 'bg-purple-500', bar: 'bg-purple-500' };
    if (isCancelled) return { label: 'Cancelled', dot: 'bg-slate-300', bar: 'bg-slate-300' };
    return { label: 'Pending', dot: 'bg-amber-400', bar: 'bg-amber-400' };
  }

  const status = statusInfo();

  const animateClass = visible ? 'opacity-100' : 'opacity-0';
  const slideClass = visible ? 'translate-x-0' : 'translate-x-full';

  return (
    <>
      <div className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ease-out lg:hidden ${animateClass}`} onClick={handleClose} />
      <div className={`fixed top-0 right-0 h-full w-full lg:w-[480px] bg-white shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out ${slideClass}`}>
        <div className={`h-1 shrink-0 ${status.bar}`} />

        {appointment.has_conflict && (
          <div className="flex items-center gap-1.5 px-7 py-2.5 bg-red-50 border-b border-red-100">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 text-red-500 shrink-0" />
            <span className="text-xs text-red-700">This appointment conflicts with your unavailability</span>
          </div>
        )}

        <div className="flex items-center justify-between px-7 pt-5 pb-2 shrink-0">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-[0.12em]">Appointment Details</div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-7 pb-6 transition-opacity duration-200 ${switching ? 'opacity-60' : ''}`}>
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
          <div className="shrink-0 border-t border-slate-100 bg-white px-7 py-5 space-y-3">
            <p className="text-xs font-medium text-slate-400 mb-3 text-center">Mark this appointment as:</p>
            <div className="flex gap-3">
              <button
                onClick={() => onRequestAttendance(appointment.id, true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-emerald-500 rounded-xl hover:bg-emerald-600 transition-colors shadow-sm"
              >
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                Attended
              </button>
              <button
                onClick={() => onRequestAttendance(appointment.id, false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-slate-700 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                Missed
              </button>
            </div>
            <div className="border-t border-slate-100 pt-3">
              {isPending && (
                <button
                  onClick={() => setShowReschedule(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                  Reschedule
                </button>
              )}
            </div>
          </div>
        )}

        <RescheduleModal
          open={showReschedule}
          appointment={showReschedule ? appointment : null}
          onClose={() => setShowReschedule(false)}
          onResolved={handleResolved}
        />
      </div>
    </>
  );
}
