import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday,
  format,
} from 'date-fns';
import { AppointmentHistoryItem } from '@/lib/api';
import { getStatusColor } from './useCurrentTime';

interface YearViewProps {
  appointments: AppointmentHistoryItem[];
  currentDate: Date;
  loading: boolean;
  refreshing?: boolean;
  onMonthClick: (date: Date) => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MiniMonth({
  year,
  monthIndex,
  eventsByDate,
  onMonthClick,
}: {
  year: number;
  monthIndex: number;
  eventsByDate: Map<string, AppointmentHistoryItem[]>;
  onMonthClick: (date: Date) => void;
}) {
  const date = new Date(year, monthIndex, 1);
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const isCurrentMonth = monthIndex === new Date().getMonth() && year === new Date().getFullYear();
  const totalEvents = Array.from(eventsByDate.entries())
    .filter(([d]) => d.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}`))
    .reduce((sum, [, evs]) => sum + evs.length, 0);

  return (
    <div
      onClick={() => onMonthClick(date)}
      className={`bg-card rounded-xl ring-1 ring-border p-3 cursor-pointer hover:ring-2 hover:ring-emerald-400/50 transition-all ${
        isCurrentMonth ? 'ring-2 ring-emerald-400/60' : ''
      }`}
    >
      <div className="text-center mb-2">
        <span className="text-sm font-bold text-foreground">{MONTHS[monthIndex]}</span>
        {totalEvents > 0 && (
          <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">
            ({totalEvents})
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[8px] font-semibold text-muted-foreground pb-0.5">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const sameMonth = isSameMonth(day, date);
          const today = isToday(day);
          const hasEvent = eventsByDate.has(dateStr);
          const eventColors = hasEvent
            ? [...new Set(eventsByDate.get(dateStr)!.map(e => getStatusColor(e)))].slice(0, 2)
            : [];

          return (
            <div
              key={day.toISOString()}
              className={`text-center text-[9px] py-0.5 rounded-sm ${
                today
                  ? 'bg-emerald-500 dark:bg-emerald-500 text-white font-bold'
                  : sameMonth
                  ? 'text-foreground'
                  : 'text-muted-foreground/20'
              }`}
            >
              {sameMonth ? format(day, 'd') : ''}
              {hasEvent && sameMonth && (
                <div className="flex items-center justify-center gap-px mt-px">
                  {eventColors.map((c, i) => (
                    <div key={i} className="size-1 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function YearView({ appointments, currentDate, loading, refreshing, onMonthClick }: YearViewProps) {
  const year = currentDate.getFullYear();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, AppointmentHistoryItem[]>();
    for (const a of appointments) {
      const existing = map.get(a.slot_date);
      if (existing) existing.push(a);
      else map.set(a.slot_date, [a]);
    }
    return map;
  }, [appointments]);

  if (loading && appointments.length === 0) {
    return (
      <div className="p-8">
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, i) => (
        <MiniMonth
          key={i}
          year={year}
          monthIndex={i}
          eventsByDate={eventsByDate}
          onMonthClick={onMonthClick}
        />
      ))}
    </div>
  );
}
