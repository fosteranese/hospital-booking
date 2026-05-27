import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, tokenStore, Patient, LastDoctorInfo } from '@/lib/api';
import { AuthFlow } from '@/components/AuthFlow';
import { PatientForm } from '@/components/PatientForm';
import { DoctorSelect } from '@/components/DoctorSelect';
import { BookingForm } from '@/components/BookingForm';
import { AppointmentSummary } from '@/components/AppointmentSummary';
import { ExistingPatientReview, ExistingPatientData, UpcomingAppointmentData } from '@/components/ExistingPatientReview';
import type { ClinicConfig } from '@/lib/api';
import { LeftPanel } from '@/components/LeftPanel';

import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Doctor01Icon, Calendar01Icon, Clock01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { ErrorMessage } from '@/components/ui/error-message';
import { LoadingOverlay } from '@/components/loading-overlay';
import { AddToCalendar } from '@/components/AddToCalendar';
import { useSearchParams } from 'react-router-dom';
import { saveBooking, loadBooking, clearBooking } from '@/lib/booking-storage';
import { cn } from '@/lib/utils';

const STEPS = ['auth', 'review', 'patient', 'doctor', 'datetime', 'confirm', 'success'] as const;
type Step = typeof STEPS[number];

function stepIndex(s: Step) {
  return STEPS.indexOf(s);
}

interface BookingSnapshot {
  token: string;
  otpIdentifier: string;
  patientFirstName: string;
  patientLastName: string;
  patientPhone: string;
  patientEmail: string;
  notes: string;
  existingPatient: ExistingPatientData | null;
  lastDoctor: LastDoctorInfo | null;
  doctorCount: number;
  doctorId: string | null;
  doctorName: string;
  slotId: string;
  bookDate: string;
  bookTime: string;
  bookEndTime: string;
  rescheduling: ReschedulingState | null;
  upcomingAppointments: UpcomingAppointmentData[];
}

interface ReschedulingState {
  appointmentId: string;
  doctorId?: string;
  doctorName?: string;
  excludeDoctorId?: string;
}

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};

export default function BookAppointment() {
  const cleared = useRef(false);
  const oldToken = useRef('');
  if (!cleared.current) {
    cleared.current = true;
    oldToken.current = tokenStore.token;
    tokenStore.clear();
    sessionStorage.clear();
    localStorage.clear();
  }

  useEffect(() => {
    if (oldToken.current) {
      api.invalidateToken(oldToken.current).catch(() => {});
    }
    if (typeof caches !== 'undefined') {
      caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))).catch(() => {});
    }
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();

  const initialStep = (() => {
    const s = searchParams.get('step') as Step;
    if (!s || !STEPS.includes(s)) return 'auth';
    const data = loadBooking<BookingSnapshot>();
    if (!data) return 'auth';
    switch (s) {
      case 'success':
      case 'confirm':
        if (!data.slotId || !data.doctorId) return 'datetime';
        break;
      case 'doctor':
      case 'datetime':
        break;
      case 'review':
      case 'patient':
        if (!data.token) return 'auth';
        break;
    }
    return s;
  })();

  const [step, setStep] = useState<Step>(initialStep);
  const [direction, setDirection] = useState(initialStep === 'auth' ? 1 : 0);

  const initialData = initialStep !== 'auth' ? loadBooking<BookingSnapshot>() : null;
  if (initialData?.token) tokenStore.set(initialData.token);

  const [token, setToken] = useState(initialData?.token ?? '');
  const [otpIdentifier, setOtpIdentifier] = useState(initialData?.otpIdentifier ?? '');
  const [patientFirstName, setPatientFirstName] = useState(initialData?.patientFirstName ?? '');
  const [patientLastName, setPatientLastName] = useState(initialData?.patientLastName ?? '');
  const [patientPhone, setPatientPhone] = useState(initialData?.patientPhone ?? '');
  const [patientEmail, setPatientEmail] = useState(initialData?.patientEmail ?? '');
  const [existingPatient, setExistingPatient] = useState<ExistingPatientData | null>(initialData?.existingPatient ?? null);
  const [lastDoctor, setLastDoctor] = useState<LastDoctorInfo | null>(initialData?.lastDoctor ?? null);
  const [doctorCount, setDoctorCount] = useState(initialData?.doctorCount ?? 0);
  const [doctorId, setDoctorId] = useState<string | null>(initialData?.doctorId ?? null);
  const [doctorName, setDoctorName] = useState(initialData?.doctorName ?? 'Auto-assigned');
  const [slotId, setSlotId] = useState(initialData?.slotId ?? '');
  const [bookDate, setBookDate] = useState(initialData?.bookDate ?? '');
  const [bookTime, setBookTime] = useState(initialData?.bookTime ?? '');
  const [bookEndTime, setBookEndTime] = useState(initialData?.bookEndTime ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointmentData[]>(initialData?.upcomingAppointments ?? []);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [rescheduling, setRescheduling] = useState<ReschedulingState | null>(initialData?.rescheduling ?? null);

  const isReschedule = rescheduling !== null;

  const [clinicConfig, setClinicConfig] = useState<ClinicConfig>({
    clinicName: 'MEDIPORT FERTILITY SERVICES',
    clinicAddress: 'Bissau Avenue, East-Legon, Accra, Ghana',
    minAdvanceDays: 7,
  });

  useEffect(() => {
    api.getAppointmentConfig().then((settings) => {
      const getName = (n: string) => settings.find((s) => s.name === n)?.value ?? '';
      const getNum = (n: string, def: number) => {
        const v = settings.find((s) => s.name === n)?.value;
        return v ? parseInt(v, 10) || def : def;
      };
      setClinicConfig({
        clinicName: getName('clinic_name') || 'MEDIPORT FERTILITY SERVICES',
        clinicAddress: getName('clinic_address') || 'Bissau Avenue, East-Legon, Accra, Ghana',
        minAdvanceDays: getNum('min_advance_days', 7),
      });
    }).catch(() => {});
  }, []);

  const resetAll = useCallback(() => {
    clearBooking();
    setSearchParams({}, { replace: true });
    setStep('auth');
    setDirection(1);
    setToken('');
    tokenStore.clear();
    setOtpIdentifier('');
    setPatientFirstName('');
    setPatientLastName('');
    setPatientPhone('');
    setPatientEmail('');
    setExistingPatient(null);
    setLastDoctor(null);
    setDoctorCount(0);
    setDoctorId(null);
    setDoctorName('Auto-assigned');
    setSlotId('');
    setBookDate('');
    setBookTime('');
    setBookEndTime('');
    setNotes('');
    setLoading(false);
    setError('');
    setUpcomingAppointments([]);
    setUpcomingLoading(false);
    setRescheduling(null);
  }, []);

  useEffect(() => {
    if (step === 'review' && existingPatient && token) {
      setUpcomingLoading(true);
      api.getUpcomingAppointments(existingPatient.id, token)
        .then(setUpcomingAppointments)
        .catch(() => setUpcomingAppointments([]))
        .finally(() => setUpcomingLoading(false));
    }
  }, [step, existingPatient, token]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (step !== 'auth') {
      params.set('step', step);
      if (token) tokenStore.set(token);
    } else {
      tokenStore.clear();
    }
    setSearchParams(params, { replace: true });

    if (step !== 'auth') {
      saveBooking({
        token,
        otpIdentifier,
        patientFirstName,
        patientLastName,
        patientPhone,
        patientEmail,
        notes,
        existingPatient,
        lastDoctor,
        doctorCount,
        doctorId,
        doctorName,
        slotId,
        bookDate,
        bookTime,
        bookEndTime,
        rescheduling,
        upcomingAppointments,
      });
    } else {
      clearBooking();
    }
  }, [
    step, token, otpIdentifier,
    patientFirstName, patientLastName, patientPhone, patientEmail,
    notes,
    existingPatient, lastDoctor, doctorCount,
    doctorId, doctorName,
    slotId, bookDate, bookTime, bookEndTime,
    rescheduling, upcomingAppointments,
  ]);

  const goToStep = (s: Step) => {
    setDirection(stepIndex(s) > stepIndex(step) ? 1 : -1);
    setStep(s);
  };

  const goBack = () => {
    setDirection(-1);
    switch (step) {
      case 'patient':
      case 'review':
        setStep('auth');
        break;
      case 'doctor':
        setStep(isReschedule ? 'review' : (existingPatient ? 'review' : 'patient'));
        setRescheduling(null);
        break;
      case 'datetime':
        setStep(isReschedule ? 'review' : 'doctor');
        setRescheduling(null);
        break;
      case 'confirm':
        setStep('datetime');
        break;
    }
  };

  const handleVerified = async (newToken: string, identifier: string) => {
    setToken(newToken);
    tokenStore.set(newToken);
    setOtpIdentifier(identifier);

    let patientData: Patient;
    try {
      patientData = await api.lookupPatient(identifier, newToken);
    } catch {
      goToStep('patient');
      return;
    }

    setExistingPatient(patientData);
    setPatientFirstName(patientData.first_name);
    setPatientLastName(patientData.last_name);
    setPatientPhone(patientData.phone);
    setPatientEmail(patientData.email);

    try {
      const [lastDoc, doctors] = await Promise.all([
        api.getLastDoctor(patientData.id, newToken),
        api.getDoctors(),
      ]);

      setLastDoctor(lastDoc);
      setDoctorCount(doctors.length);

      if (doctors.length === 1) {
        setDoctorId(doctors[0].id);
        setDoctorName(`Dr. ${doctors[0].first_name} ${doctors[0].last_name}`);
      }
    } catch {
      // secondary lookups failed — show review anyway, user can still book
    }

    goToStep('review');
  };

  const handlePatientComplete = (firstName: string, lastName: string, phone: string, email: string) => {
    setPatientFirstName(firstName);
    setPatientLastName(lastName);
    setPatientPhone(phone);
    setPatientEmail(email);
    goToStep('doctor');
  };

  const handleRebookWithLastDoctor = (docId: string, docName: string) => {
    setDoctorId(docId);
    setDoctorName(`Dr. ${docName}`);
    goToStep('datetime');
  };

  const handleChangeDoctor = () => {
    goToStep('doctor');
  };

  const handleRescheduleTime = (appt: UpcomingAppointmentData) => {
    setRescheduling({ appointmentId: appt.id, doctorId: appt.doctor_id });
    setDoctorId(appt.doctor_id);
    setDoctorName(`Dr. ${appt.doctor_name}`);
    goToStep('datetime');
  };

  const handleRescheduleDoctor = (appt: UpcomingAppointmentData) => {
    setRescheduling({ appointmentId: appt.id, excludeDoctorId: appt.doctor_id });
    goToStep('doctor');
  };

  const handleCancelAppointment = async (appointmentId: string, reason?: string) => {
    try {
      await api.updateAppointment(appointmentId, { status: 'cancelled', cancellation_reason: reason || '' }, token);
      setUpcomingAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
    } catch {
      // silently fail — appointment list stays unchanged
    }
  };

  const handlePatientUpdated = (updatedPatient: Patient) => {
    setExistingPatient(updatedPatient);
    setPatientFirstName(updatedPatient.first_name);
    setPatientLastName(updatedPatient.last_name);
    setPatientPhone(updatedPatient.phone);
    setPatientEmail(updatedPatient.email);
  };

  const handleDoctorSelect = async (id: string | null, name?: string) => {
    setDoctorId(id);
    setDoctorName(name || 'Auto-assigned');

    if (isReschedule && !rescheduling.doctorId) {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        await api.updateAppointment(rescheduling.appointmentId, { doctor_id: id }, token);
        setRescheduling(null);
        goToStep('review');
      } catch (err: any) {
        setError(err.message || 'Failed to change doctor. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    goToStep('datetime');
  };

  const handleSlotSelect = (id: string, date: string, time: string, endTime: string, selectedDoctorId?: string) => {
    setSlotId(id);
    setBookDate(date);
    setBookTime(time);
    setBookEndTime(endTime);
    if (selectedDoctorId) setDoctorId(selectedDoctorId);
    goToStep('confirm');
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      if (isReschedule) {
        await api.updateAppointment(
          rescheduling.appointmentId,
          { slot_id: slotId, doctor_id: doctorId ?? undefined },
          token
        );
      } else {
        let pid = existingPatient?.id;
        if (!pid) {
          const created = await api.createPatient(
            { first_name: patientFirstName, last_name: patientLastName, phone: patientPhone, email: patientEmail },
            token
          );
          pid = created.id;
        }
        await api.createAppointment(
          { doctor_id: doctorId!, slot_id: slotId, patient_id: pid, notes: notes || undefined },
          token
        );
      }
      goToStep('success');
    } catch (err: any) {
      setError(err.message || 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen">
      <LeftPanel step={step} wide={step === 'auth' || step === 'success'} />

      <main className="flex-1 overflow-y-auto transition-all duration-500 ease-in-out bg-gradient-to-b from-amber-50/30 via-rose-50/10 via-white to-primary/[0.03]">
        <div className="flex min-h-full min-w-0">
          <div className={cn("flex flex-col items-center justify-center flex-1 min-w-0 p-8 xl:p-10 mx-auto", step === 'auth' || step === 'success' ? "max-w-xl" : "max-w-2xl")}>
            <div className="w-full space-y-2">
              {step !== 'auth' && step !== 'success' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goBack}
                  className="-ml-2 text-muted-foreground hover:text-foreground"
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4 mr-1" />
                  Back
                </Button>
              )}

              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  {step === 'auth' && (
                    <AuthFlow onVerified={handleVerified} />
                  )}

                  {step === 'review' && existingPatient && (
                    <ExistingPatientReview
                      patient={existingPatient}
                      lastDoctor={lastDoctor}
                      doctorCount={doctorCount}
                      upcomingAppointments={upcomingAppointments}
                      upcomingLoading={upcomingLoading}
                      token={token}
                      onRebookWithLastDoctor={handleRebookWithLastDoctor}
                      onChangeDoctor={handleChangeDoctor}
                      onRescheduleTime={handleRescheduleTime}
                      onRescheduleDoctor={handleRescheduleDoctor}
                      onCancelAppointment={handleCancelAppointment}
                      onPatientUpdated={handlePatientUpdated}
                      clinicName={clinicConfig.clinicName}
                      clinicAddress={clinicConfig.clinicAddress}
                    />
                  )}

                  {step === 'patient' && (
                    <PatientForm
                      defaultFirstName={patientFirstName}
                      defaultLastName={patientLastName}
                      defaultPhone={patientPhone || (otpIdentifier && !otpIdentifier.includes('@') ? otpIdentifier : '')}
                      defaultEmail={patientEmail || (otpIdentifier && otpIdentifier.includes('@') ? otpIdentifier : '')}
                      otpIdentifier={otpIdentifier}
                      onComplete={handlePatientComplete}
                    />
                  )}

                  {step === 'doctor' && (
                    <div className="space-y-3">
                      <div className="relative">
                        <DoctorSelect onSelect={handleDoctorSelect} excludeDoctorId={rescheduling?.excludeDoctorId} />
                        <LoadingOverlay loading={loading} message="Updating doctor..." variant="inset" />
                      </div>
                      {isReschedule && !rescheduling?.doctorId && (
                        <p className="text-xs text-muted-foreground text-center">
                          Your current time slot will be kept. Only the doctor will change.
                        </p>
                      )}
                      {error && (
                        <ErrorMessage message={error} />
                      )}
                    </div>
                  )}

                  {step === 'datetime' && (
                    <BookingForm
                      doctorId={doctorId}
                      defaultDate={bookDate}
                      patientId={existingPatient?.id}
                      onSelectSlot={handleSlotSelect}
                    />
                  )}

                  {step === 'confirm' && (
                    <AppointmentSummary
                      doctorName={doctorName}
                      date={bookDate}
                      time={bookTime}
                      patientName={`${patientFirstName} ${patientLastName}`}
                      notes={notes}
                      loading={loading}
                      error={error}
                      onConfirm={handleConfirm}
                      onBack={() => { setDirection(-1); setStep('datetime'); }}
                      onNotesChange={setNotes}
                    />
                  )}

                  {step === 'success' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      className="py-12"
                    >
                      <div className="flex flex-col items-center gap-8 max-w-lg mx-auto">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.15, type: 'spring', stiffness: 250, damping: 14 }}
                          className="mx-auto size-24 rounded-full bg-gradient-to-br from-amber-50 to-primary/15 flex items-center justify-center shadow-lg shadow-primary/8"
                        >
                          <div className="relative">
                            <svg className="size-14 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <motion.path
                                d="M20 6L9 17L4 12"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ delay: 0.4, duration: 0.5, ease: 'easeInOut' }}
                              />
                            </svg>
                          </div>
                        </motion.div>

                        <div className="text-center space-y-2">
                          <h2 className="text-2xl font-bold text-foreground">
                            {isReschedule ? 'Appointment Rescheduled!' : 'Appointment Booked!'}
                          </h2>
                          <p className="text-sm text-muted-foreground/70 max-w-xs mx-auto">
                            {isReschedule
                              ? 'Your appointment has been rescheduled. We look forward to seeing you.'
                              : 'Your appointment is all set. We look forward to seeing you.'}
                          </p>
                        </div>

                        <div className="w-full rounded-xl bg-white shadow-sm shadow-black/[0.03] border overflow-hidden">
                          <div className="divide-y divide-foreground/5">
                            <div className="flex items-center gap-3.5 px-5 py-4">
                              <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                                <HugeiconsIcon icon={Doctor01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Doctor</p>
                                <p className="text-sm font-medium text-foreground mt-0.5">{doctorName}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3.5 px-5 py-4">
                              <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                                <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Date</p>
                                <p className="text-sm font-medium text-foreground mt-0.5">{new Date(bookDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3.5 px-5 py-4">
                              <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                                <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Time</p>
                                <p className="text-sm font-medium text-foreground mt-0.5">
                                  {(() => {
                                    const [h, m] = bookTime.split(':').map(Number);
                                    const p = h >= 12 ? 'PM' : 'AM';
                                    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${p}`;
                                  })()}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <AddToCalendar
                          title={`Appointment with ${doctorName}`}
                          description={`Patient: ${patientFirstName} ${patientLastName}\nDoctor: ${doctorName}`}
                          location={`${clinicConfig.clinicName}, ${clinicConfig.clinicAddress}`}
                          startDate={bookDate}
                          startTime={bookTime}
                          endTime={bookEndTime}
                        />

                        <Button onClick={resetAll} className="w-full h-11 text-base shadow-xs">
                          Book Another Appointment
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
