import { useState, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { MiniCalendar } from '@/components/MiniCalendar';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

interface CalendarSlidePanelProps {
  open: boolean;
  filterDate: string | null;
  onFilterDate: (d: string | null) => void;
  onClose: () => void;
  eventDates: Set<string>;
}

type DateRange = { key: string; label: string; from: () => string; to: () => string };

function dateStr(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export function CalendarSlidePanel({
  open, filterDate, onFilterDate, onClose, eventDates,
}: CalendarSlidePanelProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    } else {
      setVisible(false);
    }
  }, [open]);

  if (!open && !visible) return null;

  const slideClass = visible ? 'translate-x-0' : 'translate-x-full';

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 200);
  };

  const today = new Date();

  const presets: DateRange[] = [
    {
      key: 'tomorrow',
      label: 'Tomorrow',
      from: () => dateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
      to: () => dateStr(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
    },
    {
      key: 'this_week',
      label: 'This Week',
      from: () => dateStr(startOfWeek(today, { weekStartsOn: 1 })),
      to: () => dateStr(endOfWeek(today, { weekStartsOn: 1 })),
    },
    {
      key: 'next_week',
      label: 'Next Week',
      from: () => dateStr(startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 })),
      to: () => dateStr(endOfWeek(addWeeks(today, 1), { weekStartsOn: 1 })),
    },
    {
      key: 'this_month',
      label: 'This Month',
      from: () => dateStr(startOfMonth(today)),
      to: () => dateStr(endOfMonth(today)),
    },
    {
      key: 'next_month',
      label: 'Next Month',
      from: () => dateStr(startOfMonth(addMonths(today, 1))),
      to: () => dateStr(endOfMonth(addMonths(today, 1))),
    },
    {
      key: 'this_next',
      label: 'This + Next',
      from: () => dateStr(startOfMonth(today)),
      to: () => dateStr(endOfMonth(addMonths(today, 1))),
    },
  ];

  const handlePresetClick = (preset: DateRange) => {
    onFilterDate(`${preset.from()}_${preset.to()}`);
  };

  const isActive = (preset: DateRange) => filterDate === `${preset.from()}_${preset.to()}`;

  return (
    <div className={`hidden lg:block fixed top-0 right-0 h-full w-full lg:w-[480px] bg-white border-l border-slate-200 z-40 flex flex-col transition-transform duration-200 ease-out ${slideClass}`}>
      <div className="flex items-center justify-between px-7 pt-5 pb-2 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.12em]">Calendar</span>
        <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>
      <div className="shrink-0 px-7 pt-4 pb-2">
        <MiniCalendar
          variant="sidebar"
          date={filterDate ? new Date(filterDate.split('_')[0] + 'T12:00:00') : new Date()}
          selectedDate={filterDate && !filterDate.includes('_') ? new Date(filterDate + 'T12:00:00') : null}
          onDateChange={(d) => {
            const dateStr = format(d, 'yyyy-MM-dd');
            onFilterDate(filterDate?.replace(/_.*$/, '') === dateStr ? null : dateStr);
          }}
          eventDates={eventDates}
        />
      </div>
      <div className="flex-1 overflow-y-auto px-7 pb-6 border-t border-slate-200">
        <div className="pt-4 space-y-2">
          <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">Quick Select</p>
          {presets.map(preset => (
            <button
              key={preset.key}
              onClick={() => handlePresetClick(preset)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                isActive(preset)
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
