import { useState, useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday,
  format, addMonths, subMonths,
} from 'date-fns';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

interface MiniCalendarProps {
  date: Date;
  onDateChange: (date: Date) => void;
  eventDates?: Set<string>;
}

export function MiniCalendar({ date, onDateChange, eventDates }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(date));

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const dayHeaders = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground/70 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {days.map((day) => {
          const sameMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const selected = isSameDay(day, date);
          const hasEvent = eventDates?.has(format(day, 'yyyy-MM-dd'));

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateChange(day)}
              className={`
                relative text-center text-xs py-1.5 rounded-md transition-all
                ${!sameMonth ? 'text-muted-foreground/30' : ''}
                ${selected ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : ''}
                ${today && !selected ? 'ring-1 ring-primary/50 font-semibold text-primary' : ''}
                ${!selected && !today && sameMonth ? 'text-foreground hover:bg-accent/60' : ''}
              `}
            >
              {format(day, 'd')}
              {hasEvent && (
                <span className={`
                  absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full
                  ${selected ? 'bg-primary-foreground/70' : 'bg-primary/60'}
                `} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
