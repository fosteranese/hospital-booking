import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format,
} from 'date-fns';
import { AppointmentHistoryItem } from '@/lib/api';
import { getStatusColor, MAX_VISIBLE_EVENTS } from './useCurrentTime';

interface MonthViewProps {
  appointments: AppointmentHistoryItem[];
  currentDate: Date;
  loading: boolean;
  refreshing?: boolean;
  onEventClick: (appointment: AppointmentHistoryItem) => void;
  onDayClick: (date: Date) => void;
}

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function useMaxVisible() {
  const [maxVisible, setMaxVisible] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 2 : MAX_VISIBLE_EVENTS
  );
  useEffect(() => {
    const handler = () => {
      setMaxVisible(window.innerWidth < 640 ? 2 : MAX_VISIBLE_EVENTS);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return maxVisible;
}

export function MonthView({ appointments, currentDate, loading, refreshing, onEventClick, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const maxVisible = useMaxVisible();

  const days = useMemo(() => {
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [monthStart, monthEnd]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AppointmentHistoryItem[]>();
    for (const a of appointments) {
      const existing = map.get(a.slot_date);
      if (existing) existing.push(a);
      else map.set(a.slot_date, [a]);
    }
    return map;
  }, [appointments]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const [overflowTarget, setOverflowTarget] = useState<{ date: string; events: AppointmentHistoryItem[]; el: HTMLElement } | null>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  const handleOverflowClick = useCallback((dateStr: string, events: AppointmentHistoryItem[], e: React.MouseEvent) => {
    e.stopPropagation();
    setOverflowTarget({ date: dateStr, events, el: e.currentTarget as HTMLElement });
  }, []);

  useEffect(() => {
    if (!overflowTarget) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowTarget(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowTarget]);

  if (loading && appointments.length === 0) {
    return (
      <div className="bg-card rounded-xl ring-1 ring-border overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div className="p-8">
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl ring-1 ring-border relative overflow-x-auto">
      <div className="min-w-[560px] sm:min-w-0">
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center py-2 text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const sameMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                const selected = isSameDay(day, currentDate);
                const dayEvents = eventsByDate.get(dateStr) || [];
                const visible = dayEvents.slice(0, maxVisible);
                const overflow = dayEvents.length - maxVisible;

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => onDayClick(day)}
                    className={`aspect-square min-h-[70px] sm:min-h-0 p-1 sm:p-1.5 border-b border-r border-border cursor-pointer transition-colors hover:bg-muted/50 ${
                      !sameMonth ? 'bg-muted/30' : ''
                    } ${today ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') onDayClick(day); }}
                    aria-label={`${format(day, 'EEEE, MMMM d, yyyy')}${sameMonth ? `, ${dayEvents.length} appointments` : ''}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span
                        className={`text-[11px] sm:text-xs font-medium leading-tight ${
                          selected && sameMonth
                            ? 'bg-emerald-500 dark:bg-emerald-500 text-white size-5 sm:size-6 flex items-center justify-center rounded-full'
                            : today
                            ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                            : sameMonth
                            ? 'text-foreground'
                            : 'text-muted-foreground/40'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {overflow > 0 && (
                        <span
                          className="text-[10px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors relative"
                          onClick={(e) => handleOverflowClick(dateStr, dayEvents.slice(maxVisible), e)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleOverflowClick(dateStr, dayEvents.slice(maxVisible), e as any); }}
                          aria-label={`${overflow} more appointments`}
                        >
                          +{overflow}
                        </span>
                      )}
                    </div>
                    <div className="space-y-px sm:space-y-0.5">
                      {visible.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onEventClick(ev); } }}
                          aria-label={`${ev.patient_name}, ${ev.start_time}–${ev.end_time}`}
                          className="flex items-center gap-1 px-0.5 sm:px-1 py-px sm:py-0.5 rounded text-[10px] sm:text-[11px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: getStatusColor(ev) + '20', color: getStatusColor(ev), borderLeft: `2px solid ${getStatusColor(ev)}` }}
                        >
                          <span className="truncate">{ev.patient_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Overflow popover */}
        {overflowTarget && (
          <div
            ref={overflowRef}
            className="absolute z-50 bg-card border border-border rounded-xl shadow-lg p-3 min-w-[200px] max-w-[280px]"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {format(new Date(overflowTarget.date + 'T12:00:00'), 'MMM d')}
            </div>
            <div className="space-y-1 max-h-[260px] overflow-y-auto">
              {overflowTarget.events.map(ev => (
                <div
                  key={ev.id}
                  onClick={() => { onEventClick(ev); setOverflowTarget(null); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') { onEventClick(ev); setOverflowTarget(null); } }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer hover:bg-muted transition-colors"
                >
                  <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: getStatusColor(ev) }} />
                  <span className="text-xs text-muted-foreground shrink-0">{ev.start_time.slice(0, 5)}</span>
                  <span className="font-medium text-foreground truncate">{ev.patient_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
