import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { AppointmentDetailModal } from '@/components/AppointmentDetailModal';

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

const AVATAR_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface HistoryModalProps {
  history: AppointmentHistoryItem[];
  loading: boolean;
  onClose: () => void;
  onMarkAttendance: (appointmentId: string, attended: boolean) => Promise<void>;
}

const PER_PAGE = 10;

export function HistoryModal({ history, loading, onClose, onMarkAttendance }: HistoryModalProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(history.length / PER_PAGE));
  const paginatedHistory = history.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => { setPage(1); }, [history]);

  return (
    <>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl flex flex-col overflow-hidden"
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

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2.5 py-8">
              <Spinner />
              <span className="text-xs text-muted-foreground">Loading history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 px-4">
              <p className="text-xs text-muted-foreground">No past appointments</p>
            </div>
          ) : (
            <>
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-muted/20 border-b border-foreground/5">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Doctor</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Date</th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Time</th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map((item) => (
                  <HistoryRow key={item.id} item={item} onMarkAttendance={onMarkAttendance} onSelect={setSelectedAppointment} />
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-foreground/5">
                <p className="text-[11px] text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="text-[11px] font-medium text-primary underline-offset-2 hover:underline transition-colors disabled:opacity-30 disabled:no-underline"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="text-[11px] font-medium text-primary underline-offset-2 hover:underline transition-colors disabled:opacity-30 disabled:no-underline"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>

    <AnimatePresence>
      {selectedAppointment && (
        <AppointmentDetailModal
          appointment={{
            id: selectedAppointment.id,
            doctor_name: selectedAppointment.doctor_name,
            specialization: selectedAppointment.specialization,
            slot_date: selectedAppointment.slot_date,
            start_time: selectedAppointment.start_time,
            end_time: selectedAppointment.end_time,
            status: selectedAppointment.status,
            notes: selectedAppointment.notes,
            attended: selectedAppointment.attended,
            cancellation_reason: selectedAppointment.cancellation_reason,
          }}
          onClose={() => setSelectedAppointment(null)}
        />
      )}
    </AnimatePresence>
  </>
  );
}

function HistoryRow({
  item,
  onMarkAttendance,
  onSelect,
}: {
  item: AppointmentHistoryItem;
  onMarkAttendance: (id: string, attended: boolean) => void;
  onSelect: (item: AppointmentHistoryItem) => void;
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
    <tr
      className="border-b border-foreground/5 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
      onClick={() => onSelect(item)}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar size="default">
            <AvatarFallback className={`text-sm font-semibold ${getAvatarColor(item.doctor_name).bg} ${getAvatarColor(item.doctor_name).text}`}>
              {item.doctor_name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-foreground text-sm">Dr. {item.doctor_name}</p>
            <p className="text-[11px] text-muted-foreground">{item.specialization}</p>
            {item.notes && (
              <p className="text-[11px] text-muted-foreground/60 italic mt-0.5 sm:hidden">{item.notes}</p>
            )}
          </div>
        </div>
        {item.notes && (
          <p className="text-[11px] text-muted-foreground/60 italic mt-1.5 hidden sm:block">{item.notes}</p>
        )}
      </td>
      <td className="px-5 py-3.5 text-foreground">{item.slot_date}</td>
      <td className="px-5 py-3.5 text-muted-foreground">{formatTime(item.start_time)}</td>
      <td className="px-5 py-3.5 text-right">
        {item.status === 'cancelled' ? (
          <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-200 bg-rose-50">Cancelled</Badge>
        ) : item.attended === true ? (
          <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-1">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-3" />
            Attended
          </Badge>
        ) : item.attended === false ? (
          <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-700 bg-rose-50 gap-1">
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
            Missed
          </Badge>
        ) : marking ? (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
            <Spinner />
            Updating...
          </span>
        ) : (
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleMark(true); }}
              className="text-[11px] font-medium text-emerald-600 underline-offset-2 hover:underline transition-colors"
            >
              Attended
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleMark(false); }}
              className="text-[11px] font-medium text-rose-600 underline-offset-2 hover:underline transition-colors"
            >
              Missed
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
