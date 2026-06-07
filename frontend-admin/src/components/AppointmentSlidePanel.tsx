import { useState, useEffect } from 'react';
import { AppointmentHistoryItem } from '@/lib/api';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Mail01Icon,
  CallIcon,
  AlertCircleIcon,
  Calendar01Icon,
  TimeScheduleIcon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function AppointmentSlidePanel({
  appointment,
  onClose,
  onRequestAttendance,
  onReschedule,
  onScheduleNew,
  canSchedule = true,
  scheduleLabel = 'New Appointment',
  attendedFollowUpDays = 30,
  attendedReferralDays = 30,
  missedRescheduleDays = 7,
  missedReferralDays = 7,
  forcedScheduleType,
}: {
  appointment: AppointmentHistoryItem;
  onClose: () => void;
  onRequestAttendance: (id: string, attended: boolean) => void;
  onReschedule?: (appointment: AppointmentHistoryItem) => void;
  onScheduleNew?: (appointment: AppointmentHistoryItem) => void;
  canSchedule?: boolean;
  scheduleLabel?: string;
  attendedFollowUpDays?: number;
  attendedReferralDays?: number;
  missedRescheduleDays?: number;
  missedReferralDays?: number;
  forcedScheduleType?: 'follow-up' | 'referral';
}) {
  const [visible, setVisible] = useState(false);
  const [switching, setSwitching] = useState(false);

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

  const isAttended = appointment.attended === true;
  const isMissed = appointment.attended === false;
  const isCancelled = appointment.status === 'cancelled';
  const isBeforeToday = (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(appointment.slot_date + 'T00:00:00') < today;
  })();
  const isPending = !isAttended && !isMissed && !isCancelled && !isBeforeToday;
  const effectivelyMissed = isMissed || (isBeforeToday && !isAttended && !isCancelled);

  const apptDate = new Date(appointment.slot_date + 'T00:00:00');
  const today = new Date();
  const daysSince = Math.floor((today.getTime() - apptDate.getTime()) / 86400000);

  const attendedDays = forcedScheduleType === 'referral' ? attendedReferralDays : attendedFollowUpDays;
  const canReschedule = isPending || (effectivelyMissed && daysSince <= missedRescheduleDays);
  const canScheduleNew = canSchedule && (
    isPending
    || (isAttended && daysSince <= attendedDays)
    || (effectivelyMissed && daysSince <= missedReferralDays)
  );

  function statusInfo() {
    if (isAttended) return { label: `Attended${appointment.minutes_late ? ` · ${appointment.minutes_late}m late` : ''}`, dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
    if (isMissed) return { label: 'Missed', dot: 'bg-purple-500', bar: 'bg-purple-500' };
    if (isCancelled) return { label: 'Cancelled', dot: 'bg-slate-300', bar: 'bg-slate-300' };
    if (isBeforeToday) return { label: 'Missed', dot: 'bg-purple-500', bar: 'bg-purple-500' };
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

        {/* Conflict banner */}
        {appointment.has_conflict && (
          <div className="flex items-center gap-1.5 px-7 py-2.5 bg-red-50 border-b border-red-100">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 text-red-500 shrink-0" />
            <span className="text-xs text-red-700">This appointment conflicts with your unavailability</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-5 pb-2 shrink-0">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-[0.12em]">Appointment Details</div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className={`flex-1 overflow-y-auto px-7 pb-6 transition-opacity duration-200 ${switching ? 'opacity-60' : ''}`}>
          {/* Patient header */}
          <div className="flex items-center gap-4 pt-6">
            <div className="size-12 rounded-full bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 shrink-0 shadow-sm">
              {(appointment.patient_name || 'P').split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-slate-900 truncate">{appointment.patient_name || 'Patient'}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`size-2 rounded-full ${status.dot}`} />
                <span className="text-sm font-medium text-slate-600">{status.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {((appointment.patient_phone ?? '').length > 0) && (
                <a href={`tel:${appointment.patient_phone}`} title={appointment.patient_phone || 'No phone'}
                  className="size-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 transition-all"
                >
                  <HugeiconsIcon icon={CallIcon} className="size-4" />
                </a>
              )}
              {((appointment.patient_email ?? '').length > 0) && (
                <a href={`mailto:${appointment.patient_email}`} title={appointment.patient_email}
                  className="size-9 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:text-blue-500 transition-all"
                >
                  <HugeiconsIcon icon={Mail01Icon} className="size-4" />
                </a>
              )}
            </div>
          </div>

          {/* Contain Details */}
          {((appointment.patient_phone ?? '').length > 0 || (appointment.patient_email ?? '').length > 0) && (<div className="mt-5 bg-slate-50 rounded-xl p-4 space-y-4">
            {(appointment.patient_phone ?? '').length > 0 && (<div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <HugeiconsIcon icon={CallIcon} className="size-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Phone</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {appointment.patient_phone}
                </div>
              </div>
            </div>)}
            {(appointment.patient_email ?? '').length > 0 && (<div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <HugeiconsIcon icon={Mail01Icon} className="size-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Email</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{appointment.patient_email}</div>
              </div>
            </div>)}
          </div>)}

          {/* Appointment details card */}
          <div className="mt-5 bg-slate-50 rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Date</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">
                  {new Date(appointment.slot_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-white flex items-center justify-center shadow-sm">
                <HugeiconsIcon icon={TimeScheduleIcon} className="size-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Time</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{formatTime(appointment.start_time)} — {formatTime(appointment.end_time)}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div className="mt-5 bg-slate-50 rounded-xl p-4 space-y-4">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Notes</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{appointment.notes}</div>
            </div>
          )}

          {/* Cancellation reason */}
          {appointment.cancellation_reason && (
            <div className="mt-5 bg-slate-50 rounded-xl p-4 space-y-4">
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Cancellation Reason</div>
                <div className="text-sm font-semibold text-slate-900 mt-0.5">{appointment.cancellation_reason}</div>
            </div>
          )}
        </div>

        {/* Action buttons — sticky footer */}
        {isPending && (
          <div className="shrink-0 bg-white py-5 border-t border-slate-200">
            {/* Attendance row */}
            <div className="flex gap-3 px-7">
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

            {(canReschedule || canScheduleNew) && (
            <div className="border-t border-slate-100 pt-4 mt-4">
            <div className="flex gap-2 px-7">
              {canReschedule && (
                <button
                  onClick={() => onReschedule?.(appointment)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-600 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <HugeiconsIcon icon={TimeScheduleIcon} className="size-4" />
                  Reschedule
                </button>
              )}
              {canScheduleNew && (
              <button
                onClick={() => onScheduleNew?.(appointment)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-sky-600 bg-sky-50 rounded-xl border border-sky-200 hover:bg-sky-100 hover:text-sky-700 transition-colors"
              >
                <HugeiconsIcon icon={Calendar01Icon} className="size-4" />
                {scheduleLabel}
              </button>
              )}
            </div>
            </div>
            )}
          </div>
        )}

        {/* Scheduling-only section — for attended/missed (within window) */}
        {!isPending && (canReschedule || canScheduleNew) && (
          <div className="shrink-0 border-t border-slate-200 bg-white py-5">
            <div className="flex gap-2 px-7">
              {canReschedule && (
                <button
                  onClick={() => onReschedule?.(appointment)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-600 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <HugeiconsIcon icon={TimeScheduleIcon} className="size-4" />
                  Reschedule
                </button>
              )}
              {canScheduleNew && (
              <button
                onClick={() => onScheduleNew?.(appointment)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-sky-600 bg-sky-50 rounded-xl border border-sky-200 hover:bg-sky-100 hover:text-sky-700 transition-colors"
              >
                <HugeiconsIcon icon={Calendar01Icon} className="size-4" />
                {scheduleLabel}
              </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
