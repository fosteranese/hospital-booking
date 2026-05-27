import { useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Clock01Icon, Calendar01Icon } from "@hugeicons/core-free-icons";
import type { UpcomingAppointmentData } from "@/components/ExistingPatientReview";

interface CancelAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: UpcomingAppointmentData | null;
  onConfirm: (reason?: string) => void;
  isCancelling: boolean;
}

function CancelAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onConfirm,
  isCancelling,
}: CancelAppointmentDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm(reason.trim());
  };

  const handleClose = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/10 backdrop-blur-xs p-0 sm:p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-2xl bg-white rounded-2xl flex flex-col overflow-hidden max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pt-4 pb-3 border-b border-foreground/5 shrink-0">
              <p className="text-sm font-semibold text-foreground">Cancel appointment</p>
              <button
                type="button"
                onClick={handleClose}
                disabled={isCancelling}
                className="size-7 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors disabled:opacity-40"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              <div className="relative bg-gradient-to-br from-rose-50 via-rose-50/60 to-primary/8 px-4 py-4 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,oklch(0.65 0.12 25/0.1),transparent_60%)]" />
                <div className="relative flex items-center gap-3">
                  <motion.div
                    initial={{ scale: 0, rotate: 30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                    className="size-10 rounded-xl bg-destructive flex items-center justify-center shrink-0 shadow-xs"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-5 text-white" />
                  </motion.div>
                  <div>
                    <p className="text-sm font-semibold text-destructive">Cancel appointment</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              {appointment && (
                <div className="border-l-2 border-destructive/40 pl-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Dr. {appointment.doctor_name}</p>
                    <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">{appointment.specialization}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                      {appointment.slot_date}
                    </span>
                    <span className="text-muted-foreground/30">&middot;</span>
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                      {appointment.start_time?.slice(0, 5)}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Reason for cancellation</p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please provide a reason..."
                  className="w-full min-h-[72px] resize-none rounded-lg border border-foreground/10 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-colors"
                />
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 bg-white px-5 py-4 border-t border-foreground/5">
              <Button variant="outline" className="h-10 text-sm" onClick={handleClose} disabled={isCancelling}>
                No, keep it
              </Button>
              <Button variant="destructive" className="h-10 text-sm gap-1.5" onClick={handleConfirm} disabled={!reason.trim() || isCancelling}>
                {isCancelling ? (
                  <span className="flex items-center gap-2">
                    <span className="size-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Cancelling...
                  </span>
                ) : (
                  'Yes, cancel'
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { CancelAppointmentDialog };
