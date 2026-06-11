import { useState, useEffect, useRef } from 'react';
import { SlotResponse } from '@/lib/api';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

type Period = 'morning' | 'afternoon' | 'evening';

const periodConfig: Record<Period, { label: string; range: string }> = {
  morning:   { label: 'Morning',   range: 'Before noon' },
  afternoon: { label: 'Afternoon',  range: '12:00 — 16:59' },
  evening:   { label: 'Evening',   range: '17:00 onwards' },
};

function getPeriod(time: string): Period {
  const h = parseInt(time.split(':')[0], 10);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function groupSlotsByPeriod(slots: SlotResponse[]): { period: Period; slots: SlotResponse[] }[] {
  const groups: Record<Period, SlotResponse[]> = { morning: [], afternoon: [], evening: [] };
  for (const slot of slots) {
    groups[getPeriod(slot.start_time)].push(slot);
  }
  return Object.entries(periodConfig).map(([key]) => ({
    period: key as Period,
    slots: groups[key as Period],
  })).filter(g => g.slots.length > 0);
}

interface SlotPickerProps {
  dates: string[];
  slots: SlotResponse[];
  datesLoading: boolean;
  slotsLoading: boolean;
  selectedDate: string | null;
  selectedSlot: string | null;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slotId: string) => void;
  emptyDatesMessage?: string;
  emptySlotsMessage?: string;
}

export function SlotPicker({
  dates,
  slots,
  datesLoading,
  slotsLoading,
  selectedDate,
  selectedSlot,
  onSelectDate,
  onSelectSlot,
  emptyDatesMessage = 'No available dates found.',
  emptySlotsMessage = 'No available slots for this date.',
}: SlotPickerProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = stripRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  const scrollStrip = (dir: 'left' | 'right') => {
    const el = stripRef.current;
    if (!el) return;
    const amount = 200;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    setTimeout(checkScroll, 100);
  };

  useEffect(() => {
    checkScroll();
  }, [dates]);

  const groupedSlots = groupSlotsByPeriod(slots);

  return (
    <div>
      <div className="mb-5">
        <label className="block text-xs font-medium text-slate-600 mb-2">Select date</label>
        {datesLoading ? (
          <div className="h-[68px] bg-slate-100 rounded-xl animate-pulse" />
        ) : dates.length === 0 ? (
          <div className="text-sm text-slate-400 py-3 text-center bg-slate-50 rounded-lg">{emptyDatesMessage}</div>
        ) : (
          <div className="relative">
            <div
              ref={stripRef}
              onScroll={checkScroll}
              className="flex gap-2 overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth no-scrollbar pb-1 overscroll-x-contain"
            >
              {dates.map(d => {
                const dt = new Date(d + 'T12:00:00');
                const dayName = dt.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = dt.getDate();
                const month = dt.toLocaleDateString('en-US', { month: 'short' });
                const isSelected = d === selectedDate;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onSelectDate(d)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 min-w-[56px] sm:min-w-[68px] py-2.5 sm:py-3 px-2 sm:px-2.5 rounded-xl border transition-all shrink-0',
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                        : 'bg-card text-foreground border-border hover:border-primary/40 hover:text-primary',
                    )}
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">{dayName}</span>
                    <span className="text-lg sm:text-xl font-semibold leading-tight">{dayNum}</span>
                    <span className="text-[10px] font-medium opacity-70">{month}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => scrollStrip('left')}
              disabled={!canScrollLeft}
              className="absolute left-0 top-0 bottom-1 w-10 flex items-center justify-center rounded-l-xl disabled:opacity-0 transition-opacity cursor-pointer bg-card/80 hover:bg-card shadow-[2px_0_8px_-4px_rgba(0,0,0,0.15)] z-10"
              aria-label="Previous dates"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5 text-slate-600" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scrollStrip('right')}
              disabled={!canScrollRight}
              className="absolute right-0 top-0 bottom-1 w-10 flex items-center justify-center rounded-r-xl disabled:opacity-0 transition-opacity cursor-pointer bg-card/80 hover:bg-card shadow-[-2px_0_8px_-4px_rgba(0,0,0,0.15)] z-10"
              aria-label="Next dates"
            >
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-slate-600" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {selectedDate && (
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 mb-2">Select time</label>
          {slotsLoading ? (
            <div className="space-y-2">
              <div className="h-8 bg-slate-100 rounded-lg animate-pulse w-24" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            </div>
          ) : groupedSlots.length === 0 ? (
            <div className="text-sm text-slate-400 py-3 text-center bg-slate-50 rounded-lg">{emptySlotsMessage}</div>
          ) : (
            <div className="space-y-4">
              {groupedSlots.map(({ period, slots: periodSlots }) => (
                <div key={period} className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground">{periodConfig[period].label}</span>
                    <span className="text-[11px] text-slate-400">{periodConfig[period].range}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {periodSlots.map(slot => {
                      const isSel = selectedSlot === slot.id;
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => onSelectSlot(slot.id)}
                          className={cn(
                            'relative flex items-center justify-center w-full text-center rounded-xl border px-2 py-2.5 transition-all overflow-hidden',
                            isSel
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-card text-foreground border-border hover:border-primary/40 active:scale-[0.98]'
                          )}
                        >
                          <span className={cn('text-xs font-medium', isSel && 'text-white')}>
                            {slot.start_time.slice(0, 5)} — {slot.end_time.slice(0, 5)}
                          </span>
                          {isSel && (
                            <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-card flex items-center justify-center shadow-xs">
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="size-2.5 text-primary" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
