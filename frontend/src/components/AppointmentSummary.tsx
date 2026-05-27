import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserIcon, Doctor01Icon, Calendar01Icon, Clock01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';

interface AppointmentSummaryProps {
  doctorName: string;
  specialization?: string;
  date: string;
  time: string;
  patientName: string;
  notes: string;
  loading: boolean;
  error?: string;
  onConfirm: () => void;
  onBack: () => void;
  onNotesChange: (notes: string) => void;
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
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  } catch {
    return timeStr;
  }
}

export function AppointmentSummary({ doctorName, specialization, date, time, patientName, notes, loading, error, onConfirm, onBack, onNotesChange }: AppointmentSummaryProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card className="w-full mx-auto bg-transparent ring-0 shadow-none overflow-visible">
        <CardHeader className="px-0">
          <CardTitle className="text-foreground">Almost there</CardTitle>
        </CardHeader>
        <CardContent className="px-0 space-y-6">
          <div className="rounded-xl bg-white shadow-sm shadow-black/[0.03] border overflow-hidden">
            <div className="relative bg-gradient-to-br from-amber-50 via-rose-50/50 to-primary/8 px-5 py-5 flex items-center gap-3.5 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,oklch(0.75 0.08 50/0.12),transparent_60%)]" />
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                className="relative size-11 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-xs"
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-5.5 text-white" />
              </motion.div>
              <div className="relative">
                <p className="text-sm font-semibold text-primary">Appointment Summary</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Please review your details below</p>
              </div>
            </div>
            <div className="divide-y divide-foreground/5">
              <div className="flex items-center gap-3.5 px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
                <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                  <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Patient</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{patientName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
                <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                  <HugeiconsIcon icon={Doctor01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Doctor</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{doctorName}</p>
                  {specialization && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{specialization}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3.5 px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
                <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                  <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Date</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{formatDate(date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
                <div className="size-9 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 ring-1 ring-primary/[0.04]">
                  <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Time</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{formatTime(time)}</p>
                </div>
              </div>
              <div className="px-5 py-4 hover:bg-foreground/[0.02] transition-colors">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Reason for visit (optional)</p>
                  <textarea
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder="Briefly describe your reason for visit..."
                    className="w-full min-h-[80px] resize-none rounded-lg border border-foreground/10 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-colors"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>


          {error && <ErrorMessage message={error} />}

          <div className="flex flex-col gap-3 pt-1">
            <Button className="w-full h-11 text-base shadow-xs" onClick={onConfirm} disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Booking...
                </span>
              ) : (
                'Confirm Booking'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
