import { useState, useEffect, useRef } from 'react';
import { AppointmentHistoryItem } from '@/lib/api';
import { formatTime, formatDate } from '@/lib/helpers';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle01Icon,
  Cancel01Icon,
  Mail01Icon,
  CallIcon,
  AlertCircleIcon,
  Calendar01Icon,
  TimeScheduleIcon,
  ArrowRight01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';



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
  const panelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [switching, setSwitching] = useState(false);

  useFocusTrap(panelRef, visible);

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
  const isAppointmentTimePast = (() => {
    const apptDate = new Date(appointment.slot_date + 'T00:00:00');
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    if (apptDate < todayDate) return true;
    if (apptDate > todayDate) return false;
    const [h, m] = (appointment.end_time || '23:59').split(':').map(Number);
    const slotEnd = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), h, m);
    return new Date() >= slotEnd;
  })();
  const isPending = !isAttended && !isMissed && !isCancelled && !isBeforeToday;
  const canMarkAttendance = isPending && isAppointmentTimePast;
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
    if (isAttended) {
      let arrivalDisplay = '';
      if (appointment.arrival_time) {
        const timePart = appointment.arrival_time.split('T')[1]?.slice(0, 5);
        if (timePart) arrivalDisplay = formatTime(timePart);
      } else if (appointment.minutes_late) {
        const [h, m] = appointment.start_time.split(':').map(Number);
        const totalMin = h * 60 + m + appointment.minutes_late;
        const newH = Math.floor(totalMin / 60) % 24;
        const newM = totalMin % 60;
        arrivalDisplay = `${newH % 12 || 12}:${String(newM).padStart(2, '0')} ${newH >= 12 ? 'PM' : 'AM'}`;
      }
      return { label: `Attended${arrivalDisplay ? ` · arrived ${arrivalDisplay}` : ''}`, dot: 'bg-emerald-500', bar: 'bg-emerald-500' };
    }
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
      <div className={`fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-40 transition-opacity duration-200 ease-out lg:hidden ${animateClass}`} onClick={handleClose} />
      <div ref={panelRef} className={`fixed top-0 right-0 h-full w-full lg:w-[480px] bg-card shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out ${slideClass}`}>
        <div className={`h-1 shrink-0 ${status.bar}`} />

        {/* Conflict banner */}
        {appointment.has_conflict && (
          <div className="px-7 py-2.5 bg-red-50 dark:bg-red-950/40 border-b border-red-100 dark:border-red-900/60">
            <div className="flex items-center gap-1.5">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 text-red-500 dark:text-red-400 shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-400 font-medium">Scheduling Conflict</span>
            </div>
            <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5 ml-5">
              This appointment overlaps with your unavailability period. Consider rescheduling.
            </p>
          </div>
        )}

        {/* Referral banner */}
        {appointment.referring_doctor_id && (
          <div className="flex items-center gap-1.5 px-7 py-2.5 bg-violet-50 border-b border-violet-100">
            <HugeiconsIcon icon={UserGroupIcon} className="size-3.5 text-violet-500 shrink-0" />
            <span className="text-xs text-violet-700">
              Referred by <strong>{appointment.referring_doctor_name || 'another doctor'}</strong>
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-5 pb-2 shrink-0">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">Appointment Details</div>
          <button onClick={handleClose} data-close-modal aria-label="Close panel" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className={`flex-1 overflow-y-auto px-7 pb-6 transition-opacity duration-200 ${switching ? 'opacity-60' : ''}`}>
          {/* Patient header */}
          <div className="flex items-center gap-4 pt-6">
            <div className="size-12 rounded-full bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0 shadow-sm">
              {(appointment.patient_name || 'P').split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-foreground truncate">{appointment.patient_name || 'Patient'}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`size-2 rounded-full ${status.dot}`} />
                <span className="text-sm font-medium text-foreground">{status.label}</span>
                {appointment.referring_doctor_id && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                    <HugeiconsIcon icon={UserGroupIcon} className="size-3" />
                    Referred
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {((appointment.patient_phone ?? '').length > 0) && (
                <a href={`tel:${appointment.patient_phone}`} title={appointment.patient_phone || 'No phone'}
                  className="size-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-emerald-50 hover:text-emerald-500 transition-all"
                >
                  <HugeiconsIcon icon={CallIcon} className="size-4" />
                </a>
              )}
              {((appointment.patient_email ?? '').length > 0) && (
                <a href={`mailto:${appointment.patient_email}`} title={appointment.patient_email}
                  className="size-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-blue-50 hover:text-blue-500 transition-all"
                >
                  <HugeiconsIcon icon={Mail01Icon} className="size-4" />
                </a>
              )}
            </div>
          </div>

          {/* Contain Details */}
          {((appointment.patient_phone ?? '').length > 0 || (appointment.patient_email ?? '').length > 0) && (<div className="mt-5 bg-muted rounded-xl p-4 space-y-4">
            {(appointment.patient_phone ?? '').length > 0 && (<div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-card flex items-center justify-center shadow-sm">
                <HugeiconsIcon icon={CallIcon} className="size-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Phone</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">
                  {appointment.patient_phone}
                </div>
              </div>
            </div>)}
            {(appointment.patient_email ?? '').length > 0 && (<div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-card flex items-center justify-center shadow-sm">
                <HugeiconsIcon icon={Mail01Icon} className="size-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Email</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{appointment.patient_email}</div>
              </div>
            </div>)}
          </div>)}

          {/* Appointment details card */}
          <div className="mt-5 bg-muted rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-card flex items-center justify-center shadow-sm">
                <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Date</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">
                  {new Date(appointment.slot_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-card flex items-center justify-center shadow-sm">
                <HugeiconsIcon icon={TimeScheduleIcon} className="size-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Time</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{formatTime(appointment.start_time)} — {formatTime(appointment.end_time)}</div>
              </div>
            </div>
          </div>

          {/* Conflict details */}
          {appointment.has_conflict && appointment.conflict_slot_date && (
            <div className="mt-5 bg-muted rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-card flex items-center justify-center shadow-sm">
                  <HugeiconsIcon icon={AlertCircleIcon} className="size-4 text-red-500 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Conflict — Unavailability</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">
                    {formatDate(appointment.conflict_slot_date)}
                    {appointment.conflict_end_date && appointment.conflict_end_date !== appointment.conflict_slot_date && (
                      <span> — {formatDate(appointment.conflict_end_date)}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {appointment.conflict_start_time ? (
                      <>{formatTime(appointment.conflict_start_time!)} — {formatTime(appointment.conflict_end_time!)}</>
                    ) : 'All day'}
                    {appointment.conflict_reason && (
                      <span className="text-muted-foreground ml-1">· {appointment.conflict_reason}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Referral details */}
          {appointment.referring_doctor_id && (
            <div className="mt-5 bg-muted rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-card flex items-center justify-center shadow-sm">
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-violet-500" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Referred by</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">{appointment.referring_doctor_name || 'Another doctor'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-card flex items-center justify-center shadow-sm">
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-emerald-500" />
                </div>
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">To</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">{appointment.doctor_name}</div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="mt-5 bg-muted rounded-xl p-4 space-y-4">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{appointment.notes}</div>
            </div>
          )}

          {/* Cancellation reason */}
          {appointment.cancellation_reason && (
            <div className="mt-5 bg-muted rounded-xl p-4 space-y-4">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Cancellation Reason</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{appointment.cancellation_reason}</div>
            </div>
          )}
        </div>

        {/* Action buttons — sticky footer */}
        {isPending && (canMarkAttendance || canReschedule || canScheduleNew) && (
          <div className={`shrink-0 bg-card py-5`}>
            {canMarkAttendance && (
            <div className="flex gap-3 px-7">
              <button
                onClick={() => onRequestAttendance(appointment.id, true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-emerald-500 dark:bg-emerald-500 rounded-xl hover:bg-emerald-600 dark:hover:bg-emerald-400 transition-colors shadow-sm"
              >
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                Attended
              </button>
              <button
                onClick={() => onRequestAttendance(appointment.id, false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-foreground bg-card rounded-xl border border-border hover:bg-muted hover:border-border transition-colors shadow-sm"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                Missed
              </button>
            </div>
            )}

            {(canReschedule || canScheduleNew) && (
            <div className='border-t border-border pt-4 mt-4'>
            <div className="flex gap-2 px-7">
              {canReschedule && (
                <button
                  onClick={() => onReschedule?.(appointment)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-xl border border-border hover:bg-muted hover:text-foreground transition-colors"
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
          <div className="shrink-0 border-t border-border bg-card py-5">
            <div className="flex gap-2 px-7">
              {canReschedule && (
                <button
                  onClick={() => onReschedule?.(appointment)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-muted-foreground bg-muted rounded-xl border border-border hover:bg-muted hover:text-foreground transition-colors"
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
