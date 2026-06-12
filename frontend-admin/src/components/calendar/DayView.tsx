import { useMemo, useRef, useEffect } from 'react';
import { format, isToday } from 'date-fns';
import { AppointmentHistoryItem } from '@/lib/api';
import { getStatusColor, timeToPercent, durationPercent, HOUR_HEIGHT, HOURS } from './useCurrentTime';

interface DayViewProps {
  appointments: AppointmentHistoryItem[];
  currentDate: Date;
  loading: boolean;
  onEventClick: (appointment: AppointmentHistoryItem) => void;
  onSlotClick: (date: Date, startTime: string) => void;
}

export function DayView({ appointments, currentDate, loading, onEventClick, onSlotClick }: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const dayEvents = useMemo(
    () => appointments.filter(a => a.slot_date === dateStr),
    [appointments, dateStr]
  );
  const isDayToday = isToday(currentDate);

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
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="text-center py-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {format(currentDate, 'EEEE')}
          </div>
          <div className={`text-lg font-bold ${isDayToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
            {format(currentDate, 'MMMM d, yyyy')}
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <div className="flex" style={{ minHeight: DAY_TOTAL_HEIGHT }}>
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

          {/* Day column */}
          <div className="flex-1 relative">
            {/* Hour grid lines */}
            {HOURS.map((_, i) => (
              <div
                key={i}
                className="h-[60px] border-b border-border"
                onClick={() => {
                  const h = i;
                  const timeStr = `${String(h).padStart(2, '0')}:00`;
                  onSlotClick(currentDate, timeStr);
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
                  className="absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden cursor-pointer hover:opacity-85 transition-opacity z-10 shadow-sm"
                  style={{
                    top: `${top}%`,
                    height: `${height}%`,
                    minHeight: 22,
                    backgroundColor: color + '18',
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  <div className="text-sm font-semibold text-foreground leading-tight truncate">
                    {ev.patient_name}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight truncate">
                    {ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)}
                    {ev.doctor_name ? ` · ${ev.doctor_name}` : ''}
                  </div>
                </div>
              );
            })}

            {/* Current time indicator */}
            {isDayToday && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: `${timeToPercent(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)}%` }}
              >
                <div className="relative">
                  <div className="absolute -left-1 -top-1.5 size-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900" />
                  <div className="h-0.5 bg-red-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
