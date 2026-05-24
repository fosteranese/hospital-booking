import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { UpcomingAppointmentData } from "@/components/ExistingPatientReview";

interface CancelAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: UpcomingAppointmentData | null;
  onConfirm: () => void;
  isCancelling: boolean;
}

function CancelAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onConfirm,
  isCancelling,
}: CancelAppointmentDialogProps) {
  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-base">Cancel appointment</AlertDialogTitle>
            <p className="text-xs text-muted-foreground">Are you sure? This cannot be undone.</p>
            {appointment && (
              <div className="border-l-2 border-destructive/50 pl-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Dr. {appointment.doctor_name}</p>
                  <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0">{appointment.specialization}</Badge>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
                  <span>{appointment.slot_date} &middot; {appointment.start_time?.slice(0, 5)}</span>
                </div>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter className="bg-muted/40 px-6 py-4 -mx-6 -mb-6 rounded-b-xl border-t border-foreground/5 mt-2">
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onConfirm}>Yes, cancel</AlertDialogAction>
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

export { CancelAppointmentDialog };
