import { useMemo } from 'react';
import { AppointmentHistoryItem } from '@/lib/api';
import { formatDate, formatTime, isBeforeToday, PatientAvatar } from '@/lib/helpers';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar01Icon, AlertCircleIcon, UserGroupIcon,
  CheckmarkCircle01Icon, Cancel01Icon, ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { StatusDot } from '@/components/StatusDot';
import { EmptyState } from '@/components/EmptyState';

interface CalendarListViewProps {
  appointments: AppointmentHistoryItem[];
  loading: boolean;
  refreshing?: boolean;
  onSelectAppointment: (appointment: AppointmentHistoryItem) => void;
  onRequestAttendance: (id: string, attended: boolean) => void;
}

export function CalendarListView({ appointments, loading, refreshing, onSelectAppointment, onRequestAttendance }: CalendarListViewProps) {
  const today = new Date().toISOString().slice(0, 10);

  const groupedByDate = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => {
      if (a.slot_date !== b.slot_date) return a.slot_date.localeCompare(b.slot_date);
      return a.start_time.localeCompare(b.start_time);
    });
    return sorted.reduce((acc, a) => {
      if (!acc[a.slot_date]) acc[a.slot_date] = [];
      acc[a.slot_date].push(a);
      return acc;
    }, {} as Record<string, AppointmentHistoryItem[]>);
  }, [appointments]);

  const sortedDates = useMemo(() => Object.keys(groupedByDate).sort(), [groupedByDate]);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  if (loading && appointments.length === 0) {
    return (
      <div className="p-8">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={Calendar01Icon}
        title="No appointments"
        description="No appointments match the selected date range."
      />
    );
  }

  return (
    <div className="space-y-4">
      {sortedDates.map(date => {
        const rows = groupedByDate[date];
        const isTodayDate = date === today;
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const isTomorrowDate = date === tomorrow;

        return (
          <div key={date} className="rounded-lg">
            <div className="sticky top-0 z-10 bg-background px-5 py-3">
              <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                {isTodayDate ? `Today – ${todayLabel}` : isTomorrowDate ? `Tomorrow – ${todayLabel}` : formatDate(date)}
              </span>
              <span className="ml-2.5 text-xs text-muted-foreground font-medium">
                {rows.length} appointment{rows.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="bg-card rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)]">
              <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <tbody>
                    {rows.map(a => {
                      const isAttended = a.attended === true;
                      const isMissed = a.attended === false;
                      const isPending = !isAttended && !isMissed;
                      const isPast = isPending && isBeforeToday(a.slot_date);
                      const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : a.has_conflict ? '#ef4444' : isPast ? '#9333ea' : '#f59e0b';
                      const canAttend = isTodayDate && isPending && (() => {
                        const [h, m] = a.end_time.split(':').map(Number);
                        const slotEnd = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), h, m);
                        return new Date() >= slotEnd;
                      })();

                      return (
                        <tr
                          key={a.id}
                          className={`rounded-lg cursor-pointer transition-all duration-150 hover:bg-muted/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0 ${a.has_conflict ? 'bg-red-50/30 dark:bg-red-950/30' : ''}`}
                          onClick={() => onSelectAppointment(a)}
                          style={{ transformOrigin: 'center' }}
                        >
                          <td className="py-4 w-[110px] border-b border-border align-top pl-4" style={{ borderLeft: `3px solid ${borderColor}` }}>
                            <div className="flex flex-col items-start">
                              <span className="text-base font-semibold text-foreground">{formatTime(a.start_time)}</span>
                              <span className="text-xs text-muted-foreground">{formatTime(a.end_time)}</span>
                            </div>
                          </td>
                          <td className="w-10 p-2 border-b border-border text-center">
                            <PatientAvatar name={a.patient_name} />
                          </td>
                          <td className="min-w-0 py-4 border-b border-border align-top">
                            <div className="flex items-center gap-1.5">
                              <div className="text-base font-medium text-foreground truncate">{a.patient_name || 'Patient'}</div>
                              {a.has_conflict && <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 text-red-500 dark:text-red-400 shrink-0" />}
                              {a.referring_doctor_id && (
                                <span title={a.referring_doctor_name ? `Referred by Dr. ${a.referring_doctor_name}` : 'Referred by another doctor'}>
                                  <HugeiconsIcon icon={UserGroupIcon} className="size-3.5 text-violet-500 shrink-0" />
                                </span>
                              )}
                              {a.referring_doctor_name && <span className="text-xs text-violet-400 ml-0.5">(ref. Dr. {a.referring_doctor_name})</span>}
                            </div>
                            {a.notes && <div className="text-xs text-muted-foreground truncate mt-0.5">{a.notes}</div>}
                          </td>
                          <td className="w-[100px] py-4 border-b border-border align-top">
                            <StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} start_time={a.start_time} arrival_time={a.arrival_time} slot_date={a.slot_date} has_conflict={a.has_conflict} />
                          </td>
                          <td className="pr-3 w-0 py-4 border-b border-border align-top">
                            {canAttend ? (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={e => e.stopPropagation()}
                              >
                                <button
                                  onClick={e => { e.stopPropagation(); onRequestAttendance(a.id, true); }}
                                  className="p-1.5 rounded-md text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                                  title="Mark attended"
                                >
                                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); onRequestAttendance(a.id, false); }}
                                  className="p-1.5 rounded-md text-red-400 hover:bg-red-50 transition-colors"
                                  title="Mark missed"
                                >
                                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); onSelectAppointment(a); }}
                                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                >
                                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={e => { e.stopPropagation(); onSelectAppointment(a); }}
                                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                >
                                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
