import { useState } from 'react';
import { format } from 'date-fns';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

interface RescheduleConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
  patientName: string;
  oldStart: Date;
  oldEnd: Date;
  newStart: Date;
  newEnd: Date;
}

export function RescheduleConfirmModal({
  open, onClose, onConfirm, patientName, oldStart, oldEnd, newStart, newEnd,
}: RescheduleConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(reason || undefined);
      onClose();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Reschedule Appointment</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Rescheduling appointment for <span className="font-semibold text-foreground">{patientName}</span>:
          </p>

          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-full min-h-[2.5rem] bg-slate-300 rounded-full mt-0.5" />
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Current</div>
                <div className="text-sm font-semibold text-slate-700">{format(oldStart, 'EEEE, MMM d, yyyy')}</div>
                <div className="text-sm text-slate-600">{format(oldStart, 'h:mm a')} — {format(oldEnd, 'h:mm a')}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-400">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-1.5 h-full min-h-[2.5rem] bg-primary rounded-full mt-0.5" />
              <div>
                <div className="text-xs text-primary font-medium uppercase tracking-wider">New</div>
                <div className="text-sm font-semibold text-foreground">{format(newStart, 'EEEE, MMM d, yyyy')}</div>
                <div className="text-sm text-foreground/80">{format(newStart, 'h:mm a')} — {format(newEnd, 'h:mm a')}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">
              Reason (optional)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., patient request, schedule conflict..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onClose}
            disabled={confirming}
            className="px-4 py-2 text-sm font-medium text-foreground bg-accent rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {confirming ? 'Rescheduling...' : 'Confirm Reschedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
