import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, Cancel01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { api, AppointmentHistoryItem } from '@/lib/api';

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function AttendanceBadge({ attended }: { attended: boolean | null }) {
  if (attended === true) {
    return (
      <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-1">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3" />
        Attended
      </Badge>
    );
  }
  if (attended === false) {
    return (
      <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-700 bg-rose-50 gap-1">
        <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
        Did not attend
      </Badge>
    );
  }
  return null;
}

function HistoryCard({
  item,
  onMarkAttendance,
}: {
  item: AppointmentHistoryItem;
  onMarkAttendance: (id: string, attended: boolean) => void;
}) {
  const [marking, setMarking] = useState(false);

  const handleMark = async (attended: boolean) => {
    setMarking(true);
    try {
      await onMarkAttendance(item.id, attended);
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="rounded-xl bg-white shadow-sm shadow-black/[0.03] border p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-semibold text-foreground">Dr. {item.doctor_name}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3.5 shrink-0" />
            <span>{item.slot_date} &middot; {formatTime(item.start_time)}</span>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] font-normal shrink-0">{item.specialization}</Badge>
      </div>
      {item.status === 'cancelled' ? (
        <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-200 bg-rose-50">Cancelled</Badge>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <AttendanceBadge attended={item.attended} />
          {item.attended === null && !marking && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => handleMark(true)}
                className="text-[10px] font-medium text-emerald-600 underline-offset-2 hover:underline transition-colors"
              >
                Attended
              </button>
              <span className="text-[10px] text-muted-foreground/30">&middot;</span>
              <button
                type="button"
                onClick={() => handleMark(false)}
                className="text-[10px] font-medium text-rose-600 underline-offset-2 hover:underline transition-colors"
              >
                Missed
              </button>
            </div>
          )}
          {item.attended === null && marking && (
            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
              <Spinner />
              Updating...
            </span>
          )}
        </div>
      )}
      {item.notes && (
        <p className="text-xs text-muted-foreground/60 italic pt-0.5">{item.notes}</p>
      )}
    </div>
  );
}

interface HistoryModalProps {
  history: AppointmentHistoryItem[];
  loading: boolean;
  onClose: () => void;
  onMarkAttendance: (appointmentId: string, attended: boolean) => Promise<void>;
}

export function HistoryModal({ history, loading, onClose, onMarkAttendance }: HistoryModalProps) {
  return (
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
        className="relative w-full max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pt-4 pb-3 border-b border-foreground/5 shrink-0">
          <p className="text-sm font-semibold text-foreground">
            Appointment history ({history.length})
          </p>
          <button
            type="button"
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2.5 py-8">
              <Spinner />
              <span className="text-xs text-muted-foreground">Loading history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-white border-2 border-dashed border-foreground/10 py-10 px-4">
              <p className="text-xs text-muted-foreground">No past appointments</p>
            </div>
          ) : (
            history.map((item) => (
              <HistoryCard key={item.id} item={item} onMarkAttendance={onMarkAttendance} />
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
