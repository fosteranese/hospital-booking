import { useMemo, useRef, useEffect } from 'react';
import {
  startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isToday,
} from 'date-fns';
import { AppointmentHistoryItem } from '@/lib/api';
import { getStatusColor, timeToPercent, durationPercent, HOUR_HEIGHT, HOURS } from './useCurrentTime';

interface WeekViewProps {
  appointments: AppointmentHistoryItem[];
  currentDate: Date;
  loading: boolean;
  onEventClick: (appointment: AppointmentHistoryItem) => void;
  onSlotClick: (date: Date, startTime: string) => void;
}

export function WeekView({ appointments, currentDate, loading, onEventClick, onSlotClick }: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  const days = useMemo(() =>
    eachDayOfInterval({ start: weekStart, end: weekEnd }),
  [weekStart, weekEnd]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AppointmentHistoryItem[]>();
    for (const a of appointments) {
      const existing = map.get(a.slot_date);
      if (existing) existing.push(a);
      else map.set(a.slot_date, [a]);
    }
    return map;
  }, [appointments]);

  useEffect(() => {
    if (scrollRef.current) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const scrollTarget = (nowMin / 1440) * 24 * HOUR_HEIGHT - HOUR_HEIGHT * 3;
      scrollRef.current.scrollTop = Math.max(0, scrollTarget);
    }
  }, []);

  if (loading && appointments.length === 0) {
    return (
      <div className="bg-card rounded-xl ring-1 ring-border overflow-hidden">
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

  const DAY_TOTAL_HEIGHT = HOUR_HEIGHT * 24;

  return (
    <div className="bg-card rounded-xl ring-1 ring-border overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex border-b border-border bg-card sticky top-0 z-10">
        <div className="w-14 shrink-0 border-r border-border" />
        {days.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={`flex-1 text-center py-2 border-r border-border last:border-r-0 ${
                today ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
              }`}
            >
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {format(day, 'EEE')}
              </div>
              <div className={`text-sm font-bold ${today ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <div className="flex relative" style={{ minHeight: DAY_TOTAL_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r border-border relative">
            {HOURS.map((h, i) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] font-medium text-muted-foreground leading-none"
                style={{ top: i * HOUR_HEIGHT - 4 }}
              >
                {h}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDate.get(dateStr) || [];

            return (
              <div key={day.toISOString()} className="flex-1 relative border-r border-border last:border-r-0">
                {/* Hour grid lines */}
                {HOURS.map((_, i) => (
                  <div
                    key={i}
                    className="h-[60px] border-b border-border"
                    onClick={() => {
                      const h = i;
                      const timeStr = `${String(h).padStart(2, '0')}:00`;
                      onSlotClick(day, timeStr);
                    }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((ev) => {
                  const top = timeToPercent(ev.start_time);
                  const height = Math.max(durationPercent(ev.start_time, ev.end_time), 1.4);
                  const color = getStatusColor(ev);

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 overflow-hidden cursor-pointer hover:opacity-85 transition-opacity z-10"
                      style={{
                        top: `${top}%`,
                        height: `${height}%`,
                        minHeight: 18,
                        backgroundColor: color + '20',
                        borderLeft: `2.5px solid ${color}`,
                      }}
                    >
                      <div className="text-[11px] font-semibold text-foreground leading-tight truncate">
                        {ev.patient_name}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight truncate">
                        {ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Current time indicator — spans all days */}
          <div
            className="absolute left-14 right-0 z-20 pointer-events-none"
            style={{ top: `${timeToPercent(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}%` }}
          >
            <div className="relative">
              <div className="h-0.5 bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
