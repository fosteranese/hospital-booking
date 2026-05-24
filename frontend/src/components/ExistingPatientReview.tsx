import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { HugeiconsIcon } from '@hugeicons/react';
import { Mail01Icon, CallIcon, Clock01Icon, Appointment01Icon, ArrowRight02Icon, Time02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

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
  status: string;
}

interface ExistingPatientReviewProps {
  patient: ExistingPatientData;
  lastDoctor: LastDoctorData | null;
  doctorCount: number;
  upcomingAppointments: UpcomingAppointmentData[];
  upcomingLoading?: boolean;
  onRebookWithLastDoctor: (doctorId: string, doctorName: string) => void;
  onChangeDoctor: () => void;
  onRescheduleTime: (appointment: UpcomingAppointmentData) => void;
  onRescheduleDoctor: (appointment: UpcomingAppointmentData) => void;
  onCancelAppointment: (appointmentId: string) => Promise<void>;
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function AppointmentCard({
  appointment,
  onRescheduleTime,
  onRescheduleDoctor,
  onCancel,
  cancelling,
}: {
  appointment: UpcomingAppointmentData;
  onRescheduleTime: () => void;
  onRescheduleDoctor: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-foreground/5 p-4 space-y-2.5">
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Dr. {appointment.doctor_name}</p>
          <Badge variant="outline" className="text-[10px] font-normal">{appointment.specialization}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {appointment.slot_date} &middot; {appointment.start_time?.slice(0, 5)}
        </p>
      </div>
      <div className="flex items-center gap-3 pt-2 border-t border-foreground/5">
            <button
              type="button"
              onClick={onRescheduleTime}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors"
            >
              Reschedule
            </button>
            <span className="text-[10px] text-muted-foreground/40">&middot;</span>
            <button
              type="button"
              onClick={onRescheduleDoctor}
              className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors"
            >
              Change doctor
            </button>
            <span className="text-[10px] text-muted-foreground/40">&middot;</span>
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
}: {
  appointments: UpcomingAppointmentData[];
  onClose: () => void;
  onRescheduleTime: (appt: UpcomingAppointmentData) => void;
  onRescheduleDoctor: (appt: UpcomingAppointmentData) => void;
  onCancelAppointment: (appointmentId: string) => Promise<void>;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

  useEffect(() => {
    if (appointments.length === 0) onClose();
  }, [appointments.length, onClose]);

  const [isCancelling, setIsCancelling] = useState(false);

  const cancellingAppt = appointments.find((a) => a.id === pendingCancelId) ?? null;

  const confirmCancel = async () => {
    if (!pendingCancelId) return;
    const id = pendingCancelId;
    setPendingCancelId(null);
    setIsCancelling(true);
    setCancellingId(id);
    try {
      await onCancelAppointment(id);
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full sm:max-w-lg max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pt-4 pb-3 border-b border-foreground/5">
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

        <div className="overflow-y-auto p-5 space-y-3">
          {appointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              onRescheduleTime={() => onRescheduleTime(appt)}
              onRescheduleDoctor={() => onRescheduleDoctor(appt)}
              onCancel={() => setPendingCancelId(appt.id)}
              cancelling={cancellingId === appt.id}
            />
          ))}
          {appointments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No appointments to show.</p>
          )}
        </div>
      </motion.div>
    </motion.div>

    <AlertDialog open={pendingCancelId !== null} onOpenChange={(open) => { if (!open) setPendingCancelId(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader className="space-y-3">
          <AlertDialogTitle className="text-base">Cancel appointment</AlertDialogTitle>
          <p className="text-xs text-muted-foreground">Are you sure? This cannot be undone.</p>
          {cancellingAppt && (
            <div className="border-l-2 border-destructive/50 pl-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Dr. {cancellingAppt.doctor_name}</p>
                <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">{cancellingAppt.specialization}</Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                <span>{cancellingAppt.slot_date} &middot; {cancellingAppt.start_time?.slice(0, 5)}</span>
              </div>
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter className="bg-muted/40 px-6 py-4 -mx-6 -mb-6 rounded-b-xl border-t border-foreground/5 mt-2">
          <AlertDialogCancel>No, keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmCancel}>Yes, cancel</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {isCancelling && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/60"
      >
        <div className="size-10 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
        <p className="text-sm font-medium text-white">Cancelling appointment...</p>
      </motion.div>
    )}
  </>
  );
}

export function ExistingPatientReview({
  patient,
  lastDoctor,
  doctorCount,
  upcomingAppointments,
  upcomingLoading = false,
  onRebookWithLastDoctor,
  onChangeDoctor,
  onRescheduleTime,
  onRescheduleDoctor,
  onCancelAppointment,
}: ExistingPatientReviewProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [showAllModal, setShowAllModal] = useState(false);

  const showTabs = lastDoctor !== null;

  const cancellingAppt = upcomingAppointments.find((a) => a.id === pendingCancelId) ?? null;

  const confirmCancel = async () => {
    if (!pendingCancelId) return;
    const id = pendingCancelId;
    setPendingCancelId(null);
    setIsCancelling(true);
    setCancellingId(id);
    try {
      await onCancelAppointment(id);
    } finally {
      setCancellingId(null);
      setIsCancelling(false);
    }
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
      <Card className="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
        <CardHeader className="px-0">
          <CardTitle className="text-lg text-foreground">Welcome back, {patient.first_name}!</CardTitle>
          <CardDescription>We found your details — review and continue below</CardDescription>
        </CardHeader>
        <CardContent className="px-0 space-y-6">
          <Card className="overflow-hidden shadow-sm ring-1 ring-foreground/5 pt-0">
            <div className="h-20 bg-gradient-to-br from-primary/10 via-primary/5 to-muted sm:h-24" />
            <CardContent className="relative pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5 ">
                <Avatar className="size-20 border-4 border-[#ffffff] shadow-lg sm:-mt-12 sm:size-28">
                  <AvatarFallback className="bg-slate-300 text-xl font-semibold text-slate-900">
                    {getInitials(patient.first_name, patient.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold leading-tight">{patient.first_name} {patient.last_name}</h3>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Returning</Badge>
                  </div>
                  <div className="space-y-0.5 pt-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-4 shrink-0" />
                      <span>{patient.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <HugeiconsIcon icon={CallIcon} strokeWidth={2} className="size-4 shrink-0" />
                      <span>{patient.phone}</span>
                    </div>
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

          <div>
              {showTabs && (
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('upcoming')}
                    className={`flex-1 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                      activeTab === 'upcoming' ? 'bg-white text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Upcoming {upcomingAppointments.length > 0 && `(${upcomingAppointments.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                      activeTab === 'history' ? 'bg-white text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    History
                  </button>
                </div>
              )}

              <div className="pt-4">
              {upcomingLoading ? (
                <div className="flex items-center justify-center gap-2.5 py-5">
                  <div className="size-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Loading appointments...</span>
                </div>
              ) : (
                <>
                  {(!showTabs || activeTab === 'upcoming') && (
                    <div className="space-y-3">
                      {(!showTabs || restCount > 0 || upcomingAppointments.length === 0) && (
                        <div className="flex items-center justify-between gap-4 min-h-[20px]">
                          {!showTabs && upcomingAppointments.length > 0 && (
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                              <HugeiconsIcon icon={Time02Icon} strokeWidth={2} className="size-3.5 text-primary shrink-0" />
                              Upcoming appointments
                              <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{upcomingAppointments.length}</span>
                            </p>
                          )}
                          {restCount > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowAllModal(true)}
                              className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors shrink-0 ml-auto"
                            >
                              View all ({upcomingAppointments.length})
                            </button>
                          )}
                        </div>
                      )}

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
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {upcomingAppointments.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-5">No upcoming appointments</p>
                      )}
                    </div>
                  )}

                  {lastDoctor && activeTab === 'history' && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Appointment01Icon} strokeWidth={2} className="size-4 text-primary shrink-0" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Last visit</p>
                      </div>
                      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">Dr. {lastDoctor.doctor_name}</p>
                          <Badge variant="outline" className="text-[10px] font-normal">{lastDoctor.specialization}</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                          <span>{lastDoctor.last_appointment_date} &middot; {lastDoctor.last_appointment_time?.slice(0,5)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {!upcomingLoading && rebookDoctor && (
            <div className="flex flex-col gap-3">
              <Button className="w-full h-12 text-base gap-2" onClick={() => onRebookWithLastDoctor(rebookDoctor.doctor_id, rebookDoctor.doctor_name)}>
                Rebook with Dr. {rebookDoctor.doctor_name}
                <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} className="size-4" />
              </Button>
              <Button variant="outline" className="w-full h-12 text-base bg-white" onClick={onChangeDoctor}>
                Choose a different doctor
              </Button>
            </div>
          )}

          {!upcomingLoading && !rebookDoctor && upcomingAppointments.length === 0 && (
            <Button className="w-full h-12 text-base gap-2" onClick={onChangeDoctor}>
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
          />
        )}
      </AnimatePresence>

      <AlertDialog open={pendingCancelId !== null} onOpenChange={(open) => { if (!open) setPendingCancelId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-base">Cancel appointment</AlertDialogTitle>
            <p className="text-xs text-muted-foreground">Are you sure? This cannot be undone.</p>
            {cancellingAppt && (
              <div className="border-l-2 border-destructive/50 pl-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Dr. {cancellingAppt.doctor_name}</p>
                  <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">{cancellingAppt.specialization}</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                  <span>{cancellingAppt.slot_date} &middot; {cancellingAppt.start_time?.slice(0, 5)}</span>
                </div>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="bg-muted/40 px-6 py-4 -mx-6 -mb-6 rounded-b-xl border-t border-foreground/5 mt-2">
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmCancel}>Yes, cancel</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isCancelling && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black/60"
        >
          <div className="size-10 rounded-full border-[3px] border-white/30 border-t-white animate-spin" />
          <p className="text-sm font-medium text-white">Cancelling appointment...</p>
        </motion.div>
      )}
    </motion.div>
  );
}
