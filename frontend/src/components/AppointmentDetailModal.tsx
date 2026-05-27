import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Calendar01Icon, Clock01Icon, Location01Icon, Note01Icon, Navigation01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { AddToCalendar } from '@/components/AddToCalendar';
import { CancelAppointmentDialog } from '@/components/cancel-appointment-dialog';
import type { UpcomingAppointmentData } from '@/components/ExistingPatientReview';

interface AppointmentDetail {
  id: string;
  doctor_name: string;
  specialization: string;
  slot_date: string;
  start_time: string;
  end_time?: string;
  status: string;
  notes?: string;
  attended?: boolean | null;
  cancellation_reason?: string;
}

interface AppointmentDetailModalProps {
  appointment: AppointmentDetail;
  onClose: () => void;
  onRescheduleTime?: () => void;
  onRescheduleDoctor?: () => void;
  onCancel?: (id: string, reason?: string) => Promise<void>;
  clinicName?: string;
  clinicAddress?: string;
}

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function StatusBadge({ status, attended }: { status: string; attended?: boolean | null }) {
  if (status === 'cancelled') {
    return <Badge variant="outline" className="text-xs text-rose-600 border-rose-200 bg-rose-50">Cancelled</Badge>;
  }
  if (attended === true) {
    return <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 bg-emerald-50 gap-1"><HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3" /> Attended</Badge>;
  }
  if (attended === false) {
    return <Badge variant="outline" className="text-xs border-rose-300 text-rose-700 bg-rose-50 gap-1"><HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" /> Missed</Badge>;
  }
  return <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">Confirmed</Badge>;
}

export function AppointmentDetailModal({ appointment, onClose, onRescheduleTime, onRescheduleDoctor, onCancel, clinicName = 'MEDIPORT FERTILITY SERVICES', clinicAddress = 'Bissau Avenue, East-Legon, Accra, Ghana' }: AppointmentDetailModalProps) {
  const [cancelling, setCancelling] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);

  const isCancelled = appointment.status === 'cancelled';

  const endTime = appointment.end_time || (() => {
    const [h, m] = appointment.start_time.split(':').map(Number);
    const total = h * 60 + m + 30;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  })();

  const fullAddress = `${clinicName}, ${clinicAddress}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

  const cancelAppt: UpcomingAppointmentData | null = pendingCancel ? {
    id: appointment.id,
    doctor_id: '',
    doctor_name: appointment.doctor_name,
    specialization: appointment.specialization,
    slot_date: appointment.slot_date,
    start_time: appointment.start_time,
    end_time: endTime,
    status: appointment.status,
    notes: appointment.notes || '',
  } : null;

  const handleConfirmCancel = async (reason?: string) => {
    if (!onCancel) return;
    setCancelling(true);
    try {
      await onCancel(appointment.id, reason);
      setPendingCancel(false);
      onClose();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/10 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pt-4 pb-3 border-b border-foreground/5 shrink-0">
          <p className="text-sm font-semibold text-foreground">Appointment details</p>
          <button
            type="button"
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="space-y-0">

            <div className="relative bg-gradient-to-br from-amber-50 via-rose-50/50 to-primary/8 px-5 py-5 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,oklch(0.75 0.08 50/0.12),transparent_60%)]" />
              <div className="relative flex items-center gap-3.5">
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                  className="size-10 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-xs"
                >
                  <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-5 text-white" />
                </motion.div>
                <div>
                  <p className="text-sm font-semibold text-primary">Appointment info</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {isCancelled ? 'This appointment was cancelled' : 'Review your appointment details below'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-xl bg-white shadow-sm shadow-black/[0.03] border overflow-hidden">
                <div className="divide-y divide-foreground/5">

                  <div className="flex items-center gap-3.5 px-5 py-4">
                    <Avatar size="default" className="size-10 ring-2 ring-primary/10">
                      <AvatarFallback className={`text-sm font-semibold ${getAvatarColor(appointment.doctor_name).bg} ${getAvatarColor(appointment.doctor_name).text}`}>
                        {appointment.doctor_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Doctor</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">Dr. {appointment.doctor_name}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{appointment.specialization}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-foreground/5">
                    <div className="flex items-center gap-3.5 px-5 py-4">
                      <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                        <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Date</p>
                        <p className="text-sm font-medium text-foreground mt-0.5 whitespace-nowrap">{formatDate(appointment.slot_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3.5 px-5 py-4">
                      <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                        <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Time</p>
                        <p className="text-sm font-medium text-foreground mt-0.5 whitespace-nowrap">{formatTime(appointment.start_time)} — {formatTime(endTime)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 px-5 py-4">
                    <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Status</p>
                      <div className="mt-0.5">
                        <StatusBadge status={appointment.status} attended={appointment.attended} />
                      </div>
                    </div>
                  </div>

                  {isCancelled && appointment.cancellation_reason && (
                    <div className="flex items-start gap-3.5 px-5 py-4">
                      <div className="size-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0 ring-1 ring-rose-200 mt-0.5">
                        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4.5 text-rose-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Cancellation reason</p>
                        <p className="text-sm text-foreground mt-0.5">{appointment.cancellation_reason}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3.5 px-5 py-4">
                    <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                      <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Location</p>
                        {!isCancelled && (
                          <button
                            type="button"
                            onClick={() => window.open(directionsUrl, '_blank', 'noopener')}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 underline-offset-2 hover:underline transition-colors"
                          >
                            <HugeiconsIcon icon={Navigation01Icon} strokeWidth={2} className="size-3.5" />
                            Get directions
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground mt-0.5">{clinicName}</p>
                      <p className="text-xs text-muted-foreground/60">{clinicAddress}</p>
                    </div>
                  </div>

                  {appointment.notes && (
                    <div className="flex items-start gap-3.5 px-5 py-4">
                      <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04] mt-0.5">
                        <HugeiconsIcon icon={Note01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Notes</p>
                        <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{appointment.notes}</p>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {!isCancelled && (
                <div className="mt-5">
                  <AddToCalendar
                    title={`Appointment with Dr. ${appointment.doctor_name}`}
                    description={`Appointment with Dr. ${appointment.doctor_name} (${appointment.specialization})${appointment.notes ? `\n\nNotes: ${appointment.notes}` : ''}`}
                    location={fullAddress}
                    startDate={appointment.slot_date}
                    startTime={appointment.start_time}
                    endTime={endTime}
                  />
                </div>
              )}

              {onRescheduleTime && onRescheduleDoctor && onCancel && !isCancelled && (
                <div className="mt-5 pt-5 border-t border-foreground/5 flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    className="h-10 text-sm"
                    onClick={() => { onClose(); onRescheduleTime(); }}
                  >
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 text-sm"
                    onClick={() => { onClose(); onRescheduleDoctor(); }}
                  >
                    Change doctor
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 text-sm text-destructive hover:text-destructive border-destructive/20 hover:border-destructive/40 hover:bg-destructive/5"
                    onClick={() => setPendingCancel(true)}
                  >
                    Cancel appointment
                  </Button>
                </div>
              )}
            </div>

          </div>
        </div>
      </motion.div>
    </motion.div>

    <CancelAppointmentDialog
      open={pendingCancel}
      onOpenChange={(open) => { if (!open) setPendingCancel(false); }}
      appointment={cancelAppt}
      onConfirm={handleConfirmCancel}
      isCancelling={cancelling}
    />
    </>
  );
}
