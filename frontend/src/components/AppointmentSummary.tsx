import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ErrorMessage } from '@/components/ui/error-message';

interface AppointmentSummaryProps {
  doctorName: string;
  date: string;
  time: string;
  patientName: string;
  loading: boolean;
  error?: string;
  onConfirm: () => void;
  onBack: () => void;
}

export function AppointmentSummary({ doctorName, date, time, patientName, loading, error, onConfirm, onBack }: AppointmentSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
        <CardHeader className="px-0">
          <CardTitle className="text-foreground">Confirm Appointment</CardTitle>
        </CardHeader>
        <CardContent className="px-0 space-y-4">
          <div className="space-y-2 rounded-lg bg-white/80 ring-1 ring-foreground/5 p-4">
            <div className="flex justify-between">
              <Label className="text-muted-foreground">Patient</Label>
              <Label className="font-medium">{patientName}</Label>
            </div>
            <Separator />
            <div className="flex justify-between">
              <Label className="text-muted-foreground">Doctor</Label>
              <Label className="font-medium">{doctorName}</Label>
            </div>
            <Separator />
            <div className="flex justify-between">
              <Label className="text-muted-foreground">Date</Label>
              <Label className="font-medium">{date}</Label>
            </div>
            <Separator />
            <div className="flex justify-between">
              <Label className="text-muted-foreground">Time</Label>
              <Label className="font-medium">{time}</Label>
            </div>
          </div>
          {error && (
            <ErrorMessage message={error} />
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 bg-white/80" onClick={onBack} disabled={loading}>
              Back
            </Button>
            <Button className="flex-1" onClick={onConfirm} disabled={loading}>
              {loading ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
