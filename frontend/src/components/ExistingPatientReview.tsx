import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Mail01Icon, CallIcon, Clock01Icon, Appointment01Icon, ArrowRight02Icon, Time02Icon } from '@hugeicons/core-free-icons';

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
  onRebookWithLastDoctor: (doctorId: string) => void;
  onChangeDoctor: () => void;
  onRescheduleTime: (appointment: UpcomingAppointmentData) => void;
  onRescheduleDoctor: (appointment: UpcomingAppointmentData) => void;
  onCancelAppointment: (appointmentId: string) => void;
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function ExistingPatientReview({
  patient,
  lastDoctor,
  doctorCount,
  upcomingAppointments,
  onRebookWithLastDoctor,
  onChangeDoctor,
  onRescheduleTime,
  onRescheduleDoctor,
  onCancelAppointment,
}: ExistingPatientReviewProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = (id: string) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      setCancellingId(id);
      onCancelAppointment(id);
    }
  };

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
          <div className="rounded-xl bg-white p-4 shadow-xs ring-1 ring-foreground/5 flex items-center gap-4 border-l-[3px] border-l-primary">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {getInitials(patient.first_name, patient.last_name)}
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{patient.first_name} {patient.last_name}</p>
                <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Returning</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                <span className="truncate">{patient.email}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon icon={CallIcon} strokeWidth={2} className="size-3.5 shrink-0" />
                <span>{patient.phone}</span>
              </div>
            </div>
          </div>

          {upcomingAppointments.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <HugeiconsIcon icon={Time02Icon} strokeWidth={2} className="size-3.5 text-primary shrink-0" />
                Upcoming appointments ({upcomingAppointments.length})
              </p>
              <AnimatePresence>
                {upcomingAppointments.map((appt) => (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.2 }}
                    className="rounded-xl bg-white p-4 shadow-xs ring-1 ring-foreground/5 space-y-3 border-l-[3px] border-l-amber-400"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">Dr. {appt.doctor_name}</p>
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full shrink-0">{appt.specialization}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                        <span>{appt.slot_date} &middot; {appt.start_time?.slice(0,5)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-1 border-t border-foreground/5">
                      <button
                        type="button"
                        onClick={() => onRescheduleTime(appt)}
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors"
                      >
                        Reschedule
                      </button>
                      <span className="text-[10px] text-muted-foreground/40">&middot;</span>
                      <button
                        type="button"
                        onClick={() => onRescheduleDoctor(appt)}
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline transition-colors"
                      >
                        Change doctor
                      </button>
                      <span className="text-[10px] text-muted-foreground/40">&middot;</span>
                      <button
                        type="button"
                        onClick={() => handleCancel(appt.id)}
                        disabled={cancellingId === appt.id}
                        className="text-xs font-medium text-destructive underline-offset-2 hover:underline transition-colors disabled:opacity-40"
                      >
                        {cancellingId === appt.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {lastDoctor && (
            <>
              <div className="rounded-xl bg-white p-4 shadow-xs ring-1 ring-foreground/5 space-y-3 border-l-[3px] border-l-primary/40">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Appointment01Icon} strokeWidth={2} className="size-4 text-primary shrink-0" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Last visit</p>
                </div>
                <div className="pl-6 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Dr. {lastDoctor.doctor_name}</p>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full shrink-0">{lastDoctor.specialization}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                    <span>{lastDoctor.last_appointment_date} &middot; {lastDoctor.last_appointment_time?.slice(0,5)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button className="w-full h-12 text-base gap-2" onClick={() => onRebookWithLastDoctor(lastDoctor.doctor_id)}>
                  Rebook with Dr. {lastDoctor.doctor_name}
                  <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} className="size-4" />
                </Button>
                <Button variant="outline" className="w-full h-12 text-base bg-white" onClick={onChangeDoctor}>
                  Choose a different doctor
                </Button>
              </div>
            </>
          )}

          {!lastDoctor && (
            <Button className="w-full h-12 text-base gap-2" onClick={onChangeDoctor}>
              {doctorCount > 1 ? 'Select a Doctor' : 'Continue'}
              <HugeiconsIcon icon={ArrowRight02Icon} strokeWidth={2} className="size-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
