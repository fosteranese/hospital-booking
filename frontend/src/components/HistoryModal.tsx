import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { AppointmentDetailModal } from '@/components/AppointmentDetailModal';
import { getAvatarColor } from '@/lib/avatar';
import { formatTime } from '@/lib/format';

interface HistoryModalProps {
  history: AppointmentHistoryItem[];
  loading: boolean;
  error?: string;
  onRetry?: () => void;
  onClose: () => void;
  onMarkAttendance: (appointmentId: string, attended: boolean) => Promise<void>;
}

const PER_PAGE = 10;

export function HistoryModal({ history, loading, error, onRetry, onClose, onMarkAttendance }: HistoryModalProps) {
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
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
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
            className="size-8 sm:size-9 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
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
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-12 px-6">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <rect x="14" y="18" width="44" height="44" rx="6" className="fill-amber-200/70" stroke="#d97706" strokeWidth="1.5" strokeLinejoin="round"/>
                <line x1="22" y1="30" x2="50" y2="30" className="stroke-amber-300" strokeWidth="2" strokeLinecap="round"/>
                <line x1="22" y1="38" x2="44" y2="38" className="stroke-amber-300" strokeWidth="2" strokeLinecap="round"/>
                <line x1="22" y1="46" x2="38" y2="46" className="stroke-amber-300" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="56" cy="18" r="10" className="fill-amber-100" stroke="#d97706" strokeWidth="1.5"/>
                <path d="M56 14V18H60" className="stroke-amber-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="56" cy="18" r="2" className="fill-amber-400"/>
              </svg>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-amber-800">Oops! Something went wrong</p>
                <p className="text-xs text-amber-600/80 max-w-xs mx-auto">{error}</p>
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-100/80 hover:bg-amber-200/60 rounded-lg px-4 py-2 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Try again
                </button>
              )}
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 px-4">
              <p className="text-xs text-muted-foreground">No past appointments</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
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
            </div>
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
                    className="text-xs sm:text-sm font-medium text-primary underline-offset-2 hover:underline transition-colors disabled:opacity-30 disabled:no-underline py-1.5 px-2"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="text-xs sm:text-sm font-medium text-primary underline-offset-2 hover:underline transition-colors disabled:opacity-30 disabled:no-underline py-1.5 px-2"
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
              className="text-xs sm:text-sm font-medium text-emerald-600 underline-offset-2 hover:underline transition-colors py-1.5 px-1"
            >
              Attended
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleMark(false); }}
              className="text-xs sm:text-sm font-medium text-rose-600 underline-offset-2 hover:underline transition-colors py-1.5 px-1"
            >
              Missed
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
