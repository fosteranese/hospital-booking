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
  selectedDate?: Date | null;
  onDateChange: (date: Date) => void;
  eventDates?: Set<string>;
  variant?: 'default' | 'sidebar';
}

export function MiniCalendar({ date, selectedDate, onDateChange, eventDates, variant = 'default' }: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(date));

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const dayHeaders = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  const isSidebar = variant === 'sidebar';

  const navBtnClass = 'w-9 h-9 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors';

  const labelClass = isSidebar
    ? 'text-slate-500 text-base font-medium'
    : 'text-slate-700 text-xs font-semibold tracking-wide';

  const headClass = isSidebar
    ? 'text-slate-400 text-xs font-semibold uppercase tracking-wider'
    : 'text-slate-400 text-[10px] font-semibold uppercase tracking-wider';

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className={navBtnClass}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-[18px]" />
        </button>
        <span className={labelClass}>
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className={navBtnClass}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-[18px]" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className={`text-center py-0.5 ${headClass}`}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const sameMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;
          const hasEvent = eventDates?.has(format(day, 'yyyy-MM-dd'));

          let cellClass = 'relative flex items-center justify-center transition-all ';
          if (!sameMonth) {
            cellClass += 'w-10 h-10 text-base text-slate-200';
          } else if (selected) {
            cellClass += 'w-11 h-11 text-lg ' + (isSidebar
              ? 'bg-emerald-500 text-white font-medium rounded ring-1 ring-emerald-400'
              : 'bg-emerald-600 text-white font-semibold shadow-sm rounded ring-1 ring-emerald-500');
          } else if (today) {
            cellClass += 'w-10 h-10 text-base ' + (isSidebar
              ? 'text-emerald-600 font-medium rounded ring-1 ring-emerald-300'
              : 'font-semibold text-emerald-600 rounded ring-1 ring-emerald-400');
          } else {
            cellClass += 'w-10 h-10 text-base ' + (isSidebar
              ? 'text-slate-500 hover:bg-slate-50 rounded'
              : 'text-slate-600 hover:bg-slate-100 rounded');
          }

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateChange(day)}
              className={cellClass}
            >
              {format(day, 'd')}
              {hasEvent && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                  selected
                    ? 'bg-white/70'
                    : isSidebar ? 'bg-emerald-400' : 'bg-emerald-500/60'
                }`} />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-center">
        <button
          onClick={() => { setCurrentMonth(startOfMonth(new Date())); onDateChange(new Date()); }}
          className="text-xs text-slate-400 hover:text-emerald-600 transition-colors font-medium"
        >
          Today
        </button>
      </div>
    </div>
  );
}
