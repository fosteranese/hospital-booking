import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HugeiconsIcon } from '@hugeicons/react';
import { Mail01Icon, CallIcon, Clock01Icon, Appointment01Icon, ArrowRight02Icon, Time02Icon, Cancel01Icon, Edit01Icon, Calendar01Icon, Location01Icon, Note01Icon, Navigation01Icon } from '@hugeicons/core-free-icons';
import { CancelAppointmentDialog } from '@/components/cancel-appointment-dialog';
import { HistoryModal } from '@/components/HistoryModal';
import { EditProfileModal } from '@/components/EditProfileModal';
import { AppointmentDetailModal } from '@/components/AppointmentDetailModal';
import { Spinner } from '@/components/ui/spinner';
import { api, AppointmentHistoryItem } from '@/lib/api';

export interface ExistingPatientData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

export interface LastDoctorData {
  doctor_id: string;
  doctor_name: string;
  specialization: string;
  last_appointment_date: string;
  last_appointment_time: string;
}

export interface UpcomingAppointmentData {
  id: string;
  doctor_id: string;
  doctor_name: string;
  specialization: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string;
}

interface ExistingPatientReviewProps {
  patient: ExistingPatientData;
  lastDoctor: LastDoctorData | null;
  doctorCount: number;
  upcomingAppointments: UpcomingAppointmentData[];
  upcomingLoading?: boolean;
  token: string;
  onRebookWithLastDoctor: (doctorId: string, doctorName: string) => void;
  onChangeDoctor: () => void;
  onRescheduleTime: (appointment: UpcomingAppointmentData) => void;
  onRescheduleDoctor: (appointment: UpcomingAppointmentData) => void;
  onCancelAppointment: (appointmentId: string, reason?: string) => Promise<void>;
  onPatientUpdated: (patient: ExistingPatientData) => void;
  clinicName: string;
  clinicAddress: string;
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
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

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function AppointmentCard({
  appointment,
  onRescheduleTime,
  onRescheduleDoctor,
  onCancel,
  cancelling,
  clinicName,
  clinicAddress,
}: {
  appointment: UpcomingAppointmentData;
  onRescheduleTime: () => void;
  onRescheduleDoctor: () => void;
  onCancel: () => void;
  cancelling: boolean;
  clinicName: string;
  clinicAddress: string;
}) {
  const fullAddress = `${clinicName}, ${clinicAddress}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

  const endTime = appointment.end_time || (() => {
    const [h, m] = appointment.start_time.split(':').map(Number);
    const total = h * 60 + m + 30;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  })();

  return (
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
          <Badge variant="outline" className="text-[10px] font-normal shrink-0">{appointment.specialization}</Badge>
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
            <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Location</p>
              <button
                type="button"
                onClick={() => window.open(directionsUrl, '_blank', 'noopener')}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 underline-offset-2 hover:underline transition-colors"
              >
                <HugeiconsIcon icon={Navigation01Icon} strokeWidth={2} className="size-3.5" />
                Get directions
              </button>
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

      <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-muted/20 border-t border-foreground/5">
        <button
          type="button"
          onClick={onRescheduleTime}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors"
        >
          Reschedule
        </button>
        <span className="text-[10px] text-muted-foreground/30">&middot;</span>
        <button
          type="button"
          onClick={onRescheduleDoctor}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors"
        >
          Change doctor
        </button>
        <span className="text-[10px] text-muted-foreground/30">&middot;</span>
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="text-xs font-medium text-destructive underline-offset-2 hover:underline transition-colors disabled:opacity-40"
        >
          {cancelling ? 'Cancelling...' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

function UpcomingAppointmentsModal({
  appointments,
  onClose,
  onRescheduleTime,
  onRescheduleDoctor,
  onCancelAppointment,
  clinicName,
  clinicAddress,
}: {
  appointments: UpcomingAppointmentData[];
  onClose: () => void;
  onRescheduleTime: (appt: UpcomingAppointmentData) => void;
  onRescheduleDoctor: (appt: UpcomingAppointmentData) => void;
  onCancelAppointment: (appointmentId: string, reason?: string) => Promise<void>;
  clinicName: string;
  clinicAddress: string;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(appointments.length / PER_PAGE));
  const paginatedAppointments = appointments.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => {
    if (appointments.length === 0) onClose();
  }, [appointments.length, onClose]);

  useEffect(() => { setPage(1); }, [appointments]);

  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<UpcomingAppointmentData | null>(null);

  const cancellingAppt = appointments.find((a) => a.id === pendingCancelId) ?? null;

  const confirmCancel = async (reason?: string) => {
    if (!pendingCancelId) return;
    const id = pendingCancelId;
    setPendingCancelId(null);
    setIsCancelling(true);
    setCancellingId(id);
    try {
      await onCancelAppointment(id, reason);
    } finally {
      setCancellingId(null);
      setIsCancelling(false);
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
          <p className="text-sm font-semibold text-foreground">
            All upcoming appointments ({appointments.length})
          </p>
          <button
            type="button"
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/20 border-b border-foreground/5">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Doctor</th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Date</th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Time</th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAppointments.map((appt) => (
                <tr
                  key={appt.id}
                  className="border-b border-foreground/5 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedAppointment(appt)}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar size="default">
                        <AvatarFallback className={`text-sm font-semibold ${getAvatarColor(appt.doctor_name).bg} ${getAvatarColor(appt.doctor_name).text}`}>
                          {appt.doctor_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground text-sm">Dr. {appt.doctor_name}</p>
                        <p className="text-[11px] text-muted-foreground">{appt.specialization}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-foreground">{appt.slot_date}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{appt.start_time?.slice(0, 5)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRescheduleTime(appt); }}
                        className="text-[11px] font-medium text-primary underline-offset-2 hover:underline transition-colors"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setPendingCancelId(appt.id); }}
                        disabled={cancellingId === appt.id}
                        className="text-[11px] font-medium text-destructive underline-offset-2 hover:underline transition-colors disabled:opacity-40"
                      >
                        {cancellingId === appt.id ? '...' : 'Cancel'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-foreground/5">
              <p className="text-[11px] text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="text-[11px] font-medium text-primary underline-offset-2 hover:underline transition-colors disabled:opacity-30 disabled:no-underline"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="text-[11px] font-medium text-primary underline-offset-2 hover:underline transition-colors disabled:opacity-30 disabled:no-underline"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>

    <CancelAppointmentDialog
      open={pendingCancelId !== null}
      onOpenChange={(open) => { if (!open) setPendingCancelId(null); }}
      appointment={cancellingAppt}
      onConfirm={confirmCancel}
      isCancelling={isCancelling}
    />

    <AnimatePresence>
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={{
            id: selectedAppointment.id,
            doctor_name: selectedAppointment.doctor_name,
            specialization: selectedAppointment.specialization,
            slot_date: selectedAppointment.slot_date,
            start_time: selectedAppointment.start_time,
            end_time: selectedAppointment.end_time,
            status: selectedAppointment.status,
            notes: selectedAppointment.notes,
          }}
          onClose={() => setSelectedAppointment(null)}
          onRescheduleTime={() => { setSelectedAppointment(null); onRescheduleTime(selectedAppointment); }}
          onRescheduleDoctor={() => { setSelectedAppointment(null); onRescheduleDoctor(selectedAppointment); }}
          onCancel={onCancelAppointment}
          clinicName={clinicName}
          clinicAddress={clinicAddress}
        />
      )}
    </AnimatePresence>
  </>
  );
}

export function ExistingPatientReview({
  patient,
  lastDoctor,
  doctorCount,
  upcomingAppointments,
  upcomingLoading = false,
  token,
  onRebookWithLastDoctor,
  onChangeDoctor,
  onRescheduleTime,
  onRescheduleDoctor,
  onCancelAppointment,
  onPatientUpdated,
  clinicName,
  clinicAddress,
}: ExistingPatientReviewProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [history, setHistory] = useState<AppointmentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    if (showHistoryModal && !historyLoading) {
      setHistoryLoading(true);
      api.getAppointmentHistory(patient.id, token)
        .then(setHistory)
        .catch(() => setHistory([]))
        .finally(() => setHistoryLoading(false));
    }
  }, [showHistoryModal, patient.id, token]);

  const cancellingAppt = upcomingAppointments.find((a) => a.id === pendingCancelId) ?? null;

  const confirmCancel = async (reason?: string) => {
    if (!pendingCancelId) return;
    const id = pendingCancelId;
    setPendingCancelId(null);
    setIsCancelling(true);
    setCancellingId(id);
    try {
      await onCancelAppointment(id, reason);
    } finally {
      setCancellingId(null);
      setIsCancelling(false);
    }
  };

  const handleMarkAttendance = async (appointmentId: string, attended: boolean) => {
    await api.updateAppointment(appointmentId, { attended }, token);
    setHistory((prev) => prev.map((h) => (h.id === appointmentId ? { ...h, attended } : h)));
  };

  const soonest = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;
  const restCount = upcomingAppointments.length - 1;
  const rebookDoctor = soonest ?? lastDoctor;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Card className="w-full mx-auto bg-transparent ring-0 shadow-none overflow-visible">
        <CardHeader className="px-0">
          <CardTitle className="text-xl text-foreground">Welcome back, {patient.first_name}</CardTitle>
          <CardDescription>Great to see you again — here's your information</CardDescription>
        </CardHeader>
        <CardContent className="px-0 space-y-5">
          <Card className="overflow-hidden shadow-sm shadow-black/[0.03] border pt-0">
            <div className="h-24 bg-gradient-to-br from-amber-50 via-rose-50/60 to-primary/5" />
            <CardContent className="relative pb-0">
              <div className="flex flex-row items-start gap-5">
                <Avatar className="border-4 border-[#ffffff] shadow-lg -mt-12 size-28">
                  <AvatarFallback className="bg-slate-300 text-xl font-semibold text-slate-900">
                    {getInitials(patient.first_name, patient.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{patient.first_name} {patient.last_name}</h3>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Returning</Badge>
                  </div>
                  <div className="space-y-0.5 pt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-4 shrink-0" />
                      <span>{patient.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <HugeiconsIcon icon={CallIcon} strokeWidth={2} className="size-4 shrink-0" />
                      <span>{patient.phone}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEditModal(true)}
                      className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors mt-1"
                    >
                      <HugeiconsIcon icon={Edit01Icon} strokeWidth={2} className="size-3 inline mr-1" />
                      Edit profile
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
            {lastDoctor && (
              <>
                <Separator />
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon icon={Appointment01Icon} strokeWidth={2} className="size-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last visit</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground">Dr. {lastDoctor.doctor_name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                        <span>{lastDoctor.last_appointment_date} &middot; {lastDoctor.last_appointment_time?.slice(0,5)}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-normal">{lastDoctor.specialization}</Badge>
                  </div>
                </CardContent>
              </>
            )}
          </Card>

          <div className="mt-6">
            <div className="space-y-3">
              {upcomingAppointments.length > 0 && (
                <div className="flex items-center justify-between gap-4 min-h-5 mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <HugeiconsIcon icon={Time02Icon} strokeWidth={2} className="size-3.5 text-primary shrink-0" />
                    Upcoming appointments
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{upcomingAppointments.length}</span>
                  </p>
                  <div className="flex items-center gap-3">
                    {restCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAllModal(true)}
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors shrink-0"
                      >
                        View all ({upcomingAppointments.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowHistoryModal(true)}
                      className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline transition-colors shrink-0"
                    >
                      History
                    </button>
                  </div>
              </div>
              )}
              {upcomingLoading ? (
                <div className="flex items-center justify-center gap-2.5 py-5">
                  <Spinner />
                  <span className="text-xs text-muted-foreground">Loading appointments...</span>
                </div>
              ) : (
                <>
                  <AnimatePresence>
                    {soonest && (
                      <motion.div
                        key={soonest.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                        transition={{ duration: 0.2 }}
                      >
                        <AppointmentCard
                          appointment={soonest}
                          onRescheduleTime={() => onRescheduleTime(soonest)}
                          onRescheduleDoctor={() => onRescheduleDoctor(soonest)}
                          onCancel={() => setPendingCancelId(soonest.id)}
                          cancelling={cancellingId === soonest.id}
                          clinicName={clinicName}
                          clinicAddress={clinicAddress}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {upcomingAppointments.length === 0 && (
                    <div className="flex flex-col items-center gap-2 rounded-xl bg-white border-2 border-dashed border-foreground/10 py-10 px-4">
                      <HugeiconsIcon icon={Appointment01Icon} strokeWidth={2} className="size-6 text-muted-foreground/40 shrink-0" />
                      <p className="text-xs text-muted-foreground">No upcoming appointments</p>
                      <button
                        type="button"
                        onClick={() => setShowHistoryModal(true)}
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors mt-1"
                      >
                        View past appointments
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!upcomingLoading && rebookDoctor && (
            <div className="flex flex-col gap-3">
              <Button className="w-full h-11 text-base gap-2 shadow-xs" onClick={() => onRebookWithLastDoctor(rebookDoctor.doctor_id, rebookDoctor.doctor_name)}>
                Rebook with Dr. {rebookDoctor.doctor_name}
                <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} className="size-4" />
              </Button>
              <Button variant="outline" className="w-full h-11 text-base bg-white" onClick={onChangeDoctor}>
                Choose a different doctor
              </Button>
            </div>
          )}

          {!upcomingLoading && !rebookDoctor && upcomingAppointments.length === 0 && (
            <Button className="w-full h-11 text-base gap-2 shadow-xs" onClick={onChangeDoctor}>
              {doctorCount > 1 ? 'Book an appointment' : 'Continue'}
              <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} className="size-4" />
            </Button>
          )}
        </CardContent>
      </Card>

      <AnimatePresence>
        {showAllModal && (
          <UpcomingAppointmentsModal
            appointments={upcomingAppointments}
            onClose={() => setShowAllModal(false)}
            onRescheduleTime={onRescheduleTime}
            onRescheduleDoctor={onRescheduleDoctor}
            onCancelAppointment={onCancelAppointment}
            clinicName={clinicName}
            clinicAddress={clinicAddress}
          />
        )}
      </AnimatePresence>

      <CancelAppointmentDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) setPendingCancelId(null); }}
        appointment={cancellingAppt}
        onConfirm={confirmCancel}
        isCancelling={isCancelling}
      />

      <AnimatePresence>
        {showHistoryModal && (
          <HistoryModal
            history={history}
            loading={historyLoading}
            onClose={() => setShowHistoryModal(false)}
            onMarkAttendance={handleMarkAttendance}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditModal && (
          <EditProfileModal
            patient={patient}
            token={token}
            onClose={() => setShowEditModal(false)}
            onSaved={onPatientUpdated}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
