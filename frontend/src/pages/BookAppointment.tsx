import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, Patient, LastDoctorInfo } from '@/lib/api';
import { AuthFlow } from '@/components/AuthFlow';
import { PatientForm } from '@/components/PatientForm';
import { DoctorSelect } from '@/components/DoctorSelect';
import { BookingForm } from '@/components/BookingForm';
import { AppointmentSummary } from '@/components/AppointmentSummary';
import { ExistingPatientReview, ExistingPatientData, UpcomingAppointmentData } from '@/components/ExistingPatientReview';
import { LeftPanel } from '@/components/LeftPanel';

import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle01Icon, ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { ErrorMessage } from '@/components/ui/error-message';
import { LoadingOverlay } from '@/components/loading-overlay';

const STEPS = ['auth', 'review', 'patient', 'doctor', 'datetime', 'confirm', 'success'] as const;
type Step = typeof STEPS[number];

function stepIndex(s: Step) {
  return STEPS.indexOf(s);
}

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24 }),
};

export default function BookAppointment() {
  const [step, setStep] = useState<Step>('auth');
  const [direction, setDirection] = useState(1);

  const [token, setToken] = useState('');
  const [otpIdentifier, setOtpIdentifier] = useState('');
  const [patientFirstName, setPatientFirstName] = useState('');
  const [patientLastName, setPatientLastName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [existingPatient, setExistingPatient] = useState<ExistingPatientData | null>(null);
  const [lastDoctor, setLastDoctor] = useState<LastDoctorInfo | null>(null);
  const [doctorCount, setDoctorCount] = useState(0);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorName, setDoctorName] = useState('Auto-assigned');
  const [slotId, setSlotId] = useState('');
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointmentData[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(false);
  const [rescheduling, setRescheduling] = useState<{ appointmentId: string; doctorId?: string; doctorName?: string; excludeDoctorId?: string } | null>(null);

  const isReschedule = rescheduling !== null;

  const resetAll = useCallback(() => {
    setStep('auth');
    setDirection(1);
    setToken('');
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
    setOtpIdentifier(identifier);

    try {
      const patientData: Patient = await api.lookupPatient(identifier, newToken);
      setExistingPatient(patientData);
      setPatientFirstName(patientData.first_name);
      setPatientLastName(patientData.last_name);
      setPatientPhone(patientData.phone);
      setPatientEmail(patientData.email);

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

      goToStep('review');
    } catch {
      goToStep('patient');
    }
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

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      await api.updateAppointment(appointmentId, { status: 'cancelled' }, token);
      setUpcomingAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
    } catch {
      // silently fail — appointment list stays unchanged
    }
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

  const handleSlotSelect = (id: string, date: string, time: string, selectedDoctorId?: string) => {
    setSlotId(id);
    setBookDate(date);
    setBookTime(time);
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
          { doctor_id: doctorId!, slot_id: slotId, patient_id: pid },
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
      <LeftPanel />

      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-white via-white to-primary/[0.03]">
        <div className="flex min-h-full">
          <div className="flex flex-col items-center justify-center flex-1 p-8 xl:p-10 max-w-xl mx-auto">
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
                      onRebookWithLastDoctor={handleRebookWithLastDoctor}
                      onChangeDoctor={handleChangeDoctor}
                      onRescheduleTime={handleRescheduleTime}
                      onRescheduleDoctor={handleRescheduleDoctor}
                      onCancelAppointment={handleCancelAppointment}
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
                      loading={loading}
                      error={error}
                      onConfirm={handleConfirm}
                      onBack={() => { setDirection(-1); setStep('datetime'); }}
                    />
                  )}

                  {step === 'success' && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      className="mt-12"
                    >
                      <Card className="w-full max-w-md mx-auto text-center shadow-xl">
                        <CardContent className="pt-10 pb-10 space-y-5">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 15 }}
                            className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center"
                          >
                            <HugeiconsIcon
                              icon={CheckmarkCircle01Icon}
                              strokeWidth={2}
                              className="size-10 text-primary"
                            />
                          </motion.div>
                          <div className="space-y-2">
                            <CardTitle className="text-2xl">
                              {isReschedule ? 'Appointment Rescheduled!' : 'Appointment Booked!'}
                            </CardTitle>
                            <CardDescription className="text-base">
                              {doctorName} on {bookDate} at {bookTime}
                            </CardDescription>
                          </div>
                          <Button onClick={resetAll} size="lg" className="mt-2 shadow-md">
                            Book Another Appointment
                          </Button>
                        </CardContent>
                      </Card>
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
