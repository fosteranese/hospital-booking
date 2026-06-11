import { HugeiconsIcon } from '@hugeicons/react';
import { format } from 'date-fns';
import { MiniCalendar } from '@/components/MiniCalendar';
import { SlidePanelShell } from '@/components/SlidePanelShell';

interface DateRangeSlidePanelProps {
  open: boolean;
  slideClass: string;
  filterDate: string | null;
  onFilterDate: (date: string | null) => void;
  onClose: () => void;
  eventDates: Set<string>;
  dateRangeOptions: readonly { readonly key: string; readonly label: string; readonly from: () => string; readonly to: () => string }[];
  selectedRange: string;
  onDateRangeChange: (key: string) => void;
}

export function DateRangeSlidePanel({
  open, slideClass, filterDate, onFilterDate, onClose,
  eventDates, dateRangeOptions, selectedRange, onDateRangeChange,
}: DateRangeSlidePanelProps) {
  if (!open) return null;

  return (
    <SlidePanelShell title="Date Range" slideClass={slideClass} onClose={onClose}>
      <div className="flex-1 overflow-y-auto shrink-0">
        <div className="px-7 py-4">
          <MiniCalendar
            variant="sidebar"
            date={filterDate ? new Date(filterDate + 'T12:00:00') : new Date()}
            selectedDate={filterDate ? new Date(filterDate + 'T12:00:00') : null}
            onDateChange={(d) => {
              const dateStr = format(d, 'yyyy-MM-dd');
              if (filterDate === dateStr) {
                onFilterDate(null);
              } else {
                onFilterDate(dateStr);
              }
            }}
            eventDates={eventDates}
            maxDate={new Date()}
          />

        {filterDate && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-3">
              Showing appointments for <span className="text-foreground font-medium">{format(new Date(filterDate + 'T12:00:00'), 'MMMM d, yyyy')}</span>
            </p>
            <button onClick={() => onFilterDate(null)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-2 rounded-md hover:bg-muted transition-colors border border-border">
              Clear filter
            </button>
          </div>
        )}
        </div>
      </div>
      <div className="border-t border-border px-7 pb-6">
        <div className="pt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Quick Select</p>
          {dateRangeOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => { onDateRangeChange(opt.key); onFilterDate(null); }}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                selectedRange === opt.key && !filterDate
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                  : 'border-border text-muted-foreground hover:bg-muted hover:border-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </SlidePanelShell>
  );
}
