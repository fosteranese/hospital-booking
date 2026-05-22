import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserIcon, Clock01Icon, RefreshIcon } from '@hugeicons/core-free-icons';

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

interface ExistingPatientReviewProps {
  patient: ExistingPatientData;
  lastDoctor: LastDoctorData | null;
  doctorCount: number;
  onRebookWithLastDoctor: (doctorId: string) => void;
  onChangeDoctor: () => void;
}

export function ExistingPatientReview({
  patient,
  lastDoctor,
  doctorCount,
  onRebookWithLastDoctor,
  onChangeDoctor,
}: ExistingPatientReviewProps) {
  return (
    <Card className="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardHeader className="px-0">
        <CardTitle className="text-foreground">Welcome Back, {patient.first_name}!</CardTitle>
        <CardDescription>We found your details on file</CardDescription>
      </CardHeader>
      <CardContent className="px-0 space-y-4">
        <div className="rounded-lg bg-white/80 ring-1 ring-foreground/5 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-4 text-muted-foreground shrink-0" />
            <Label className="font-medium">{patient.first_name} {patient.last_name}</Label>
          </div>
          <CardDescription className="pl-6">{patient.email}</CardDescription>
          <CardDescription className="pl-6">{patient.phone}</CardDescription>
        </div>

        {lastDoctor && (
          <>
            <Separator />
            <CardTitle className="text-sm text-center">Previous Appointment</CardTitle>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4 text-primary shrink-0" />
                <Label>Dr. {lastDoctor.doctor_name}</Label>
              </div>
              <CardDescription>{lastDoctor.specialization}</CardDescription>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3 shrink-0" />
                <Label>Visited: {lastDoctor.last_appointment_date} at {lastDoctor.last_appointment_time?.slice(0,5)}</Label>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button className="w-full" onClick={() => onRebookWithLastDoctor(lastDoctor.doctor_id)}>
                Rebook with Dr. {lastDoctor.doctor_name}
              </Button>
              <Button variant="outline" className="w-full bg-white/80" onClick={onChangeDoctor}>
                Choose a different doctor
              </Button>
            </div>
          </>
        )}

        {!lastDoctor && (
          <Button className="w-full" onClick={onChangeDoctor}>
            {doctorCount > 1 ? 'Select a Doctor' : 'Continue'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
