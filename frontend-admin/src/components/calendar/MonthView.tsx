import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format,
} from 'date-fns';
import { AppointmentHistoryItem } from '@/lib/api';
import { getStatusColor } from './useCurrentTime';

interface MonthViewProps {
  appointments: AppointmentHistoryItem[];
  currentDate: Date;
  loading: boolean;
  onEventClick: (appointment: AppointmentHistoryItem) => void;
  onDayClick: (date: Date) => void;
}

export function MonthView({ appointments, currentDate, loading, onEventClick, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const days = useMemo(() => {
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [monthStart, monthEnd]);

  const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

  if (loading && appointments.length === 0) {
    return (
      <div className="bg-card rounded-xl ring-1 ring-border overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {dayHeaders.map(d => (
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
    <div className="bg-card rounded-xl ring-1 ring-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {dayHeaders.map(d => (
          <div key={d} className="text-center py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{d}</div>
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
              const visible = dayEvents.slice(0, 3);
              const overflow = dayEvents.length - 3;

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onDayClick(day)}
                  className={`aspect-square p-1.5 border-b border-r border-border cursor-pointer transition-colors hover:bg-muted/50 ${
                    !sameMonth ? 'bg-muted/30' : ''
                  } ${today ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-xs font-medium leading-tight ${
                        selected && sameMonth
                          ? 'bg-emerald-500 dark:bg-emerald-500 text-white size-6 flex items-center justify-center rounded-full'
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
                      <span className="text-[10px] font-medium text-muted-foreground">+{overflow}</span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                        className="flex items-center gap-1 px-1 py-0.5 rounded text-[11px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity"
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
    </div>
  );
}
