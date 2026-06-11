import { useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { MiniCalendar } from '@/components/MiniCalendar';
import { useSlidePanel } from '@/hooks/useSlidePanel';
import { SlidePanelShell } from '@/components/SlidePanelShell';

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
  const { slideClass, shouldRender, handleClose } = useSlidePanel(open, onClose, 200);

  if (!shouldRender) return null;

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
      key: 'this_year',
      label: 'This Year',
      from: () => dateStr(new Date(today.getFullYear(), 0, 1)),
      to: () => dateStr(new Date(today.getFullYear(), 11, 31)),
    },
  ];

  const isActive = (preset: DateRange) => filterDate === `${preset.from()}_${preset.to()}`;

  const handlePresetClick = (preset: DateRange) => {
    if (isActive(preset)) {
      onFilterDate(null);
    } else {
      onFilterDate(`${preset.from()}_${preset.to()}`);
    }
  };

  return (
    <SlidePanelShell title="Calendar" slideClass={slideClass} onClose={handleClose}>
      <div className="flex-1 overflow-y-auto shrink-0 px-7 pt-4 pb-2">
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
        {filterDate && (
          <div className="mt-4">
            <button onClick={() => onFilterDate(null)}
              className="w-full text-xs text-slate-400 hover:text-slate-600 py-2 rounded-md hover:bg-slate-50 transition-colors border border-slate-100">
              Clear filter
            </button>
          </div>
        )}
      </div>
      <div className="px-7 pb-2 border-t border-slate-200">
        <div className="pt-4">
          <p className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">Quick Select</p>
          <div className="space-y-2">
            <button
              onClick={() => handlePresetClick(presets[0])}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                isActive(presets[0]) ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {presets[0].label}
            </button>
            <div className="grid grid-cols-2 gap-2">
              {presets.slice(1, 3).map(preset => (
                <button
                  key={preset.key}
                  onClick={() => handlePresetClick(preset)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                    isActive(preset) ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {presets.slice(3, 5).map(preset => (
                <button
                  key={preset.key}
                  onClick={() => handlePresetClick(preset)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                    isActive(preset) ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => handlePresetClick(presets[5])}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                isActive(presets[5]) ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {presets[5].label}
            </button>
          </div>
        </div>
      </div>
    </SlidePanelShell>
  );
}
