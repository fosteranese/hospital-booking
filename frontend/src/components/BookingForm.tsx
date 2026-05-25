import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, TimeSlot } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Clock01Icon, CheckmarkCircle01Icon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface BookingFormProps {
  doctorId: string | null;
  defaultDate?: string;
  patientId?: string;
  onSelectSlot: (slotId: string, date: string, startTime: string, endTime: string, doctorId?: string) => void;
}

type Period = 'morning' | 'afternoon' | 'evening';

const periodConfig: Record<Period, { label: string; range: string }> = {
  morning: { label: 'Morning', range: 'Before noon' },
  afternoon: { label: 'Afternoon', range: '12:00 — 16:59' },
  evening: { label: 'Evening', range: '17:00 onwards' },
};

function getPeriod(time: string): Period {
  const h = parseInt(time.split(':')[0], 10);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function SlotSkeleton() {
  return (
    <div className="h-14 rounded-xl bg-muted animate-skeleton" />
  );
}

function groupSlotsByPeriod(slots: TimeSlot[]): { period: Period; slots: TimeSlot[] }[] {
  const groups: Record<Period, TimeSlot[]> = { morning: [], afternoon: [], evening: [] };
  for (const slot of slots) {
    groups[getPeriod(slot.start_time)].push(slot);
  }
  return Object.entries(periodConfig).map(([key]) => ({
    period: key as Period,
    slots: groups[key as Period],
  })).filter(g => g.slots.length > 0);
}

export function BookingForm({ doctorId, defaultDate = '', patientId, onSelectSlot }: BookingFormProps) {
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  const checkScroll = () => {
    const el = stripRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  const scrollStrip = (dir: 'left' | 'right') => {
    const el = stripRef.current;
    if (!el) return;
    const card = el.children[0] as HTMLElement | undefined;
    const step = (card?.offsetWidth ?? 72) + 8;
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  };

  useEffect(() => {
    api.getAvailableDates(doctorId ?? undefined).then((res) => {
      setAvailableDates(res.dates);
      if (!date && res.dates.length > 0) setDate(res.dates[0]);
      setTimeout(checkScroll, 50);
    }).catch(() => setAvailableDates([]));
  }, [doctorId]);

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener('scroll', checkScroll);
  }, [availableDates]);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    setSelectedSlot(null);
    const fetch = doctorId
      ? api.getAvailability(doctorId, date, patientId)
      : api.getAllAvailability(date, patientId);
    fetch
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [date, doctorId, patientId]);

  useEffect(() => {
    if (!stripRef.current || !date) return;
    const el = stripRef.current;
    const idx = availableDates.indexOf(date);
    if (idx < 0) return;
    const child = el.children[idx] as HTMLElement | undefined;
    if (!child) return;
    const offset = child.offsetLeft - el.offsetLeft - (el.clientWidth - child.offsetWidth) / 2;
    el.scrollTo({ left: offset, behavior: 'smooth' });
  }, [date, availableDates]);

  const availableSlots = useMemo(() => slots.filter(s => !s.is_booked && !s.is_blocked), [slots]);
  const unavailableCount = slots.length - availableSlots.length;
  const grouped = useMemo(() => groupSlotsByPeriod(availableSlots), [availableSlots]);

  const handleSlotClick = (slot: TimeSlot) => {
    setSelectedSlot(slot.id);
    onSelectSlot(slot.id, slot.slot_date, slot.start_time, slot.end_time, slot.doctor_id);
  };

  return (
    <Card className="w-full max-w-lg mx-auto bg-transparent ring-0 shadow-none overflow-visible">
      <CardHeader className="px-0">
        <CardTitle className="text-foreground">{doctorId ? 'Select Date & Time' : 'Select a date'}</CardTitle>
      </CardHeader>
      <CardContent className="px-0 space-y-5">
        {availableDates.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Pick a date</p>
            <div className="relative">
              <div
                ref={stripRef}
                className="flex gap-2 overflow-x-auto scroll-smooth no-scrollbar pb-1 overscroll-x-contain"
              >
                {availableDates.map((d) => {
                  const dt = new Date(d + 'T12:00:00');
                  const dayName = dt.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = dt.getDate();
                  const month = dt.toLocaleDateString('en-US', { month: 'short' });
                  const isSelected = d === date;
                  return (
                    <motion.button
                      key={d}
                      type="button"
                      whileTap={{ scale: 0.93 }}
                      onClick={() => setDate(d)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 min-w-[72px] sm:min-w-[68px] py-3 sm:py-3 px-2.5 sm:px-2 rounded-xl border transition-all shrink-0',
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                          : 'bg-white text-foreground border-foreground/10 hover:border-primary/40 hover:text-primary',
                      )}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">{dayName}</span>
                      <span className="text-xl font-semibold leading-tight">{dayNum}</span>
                      <span className="text-[10px] font-medium opacity-70">{month}</span>
                    </motion.button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => scrollStrip('left')}
                disabled={!canScrollLeft}
                className="absolute left-0 top-0 bottom-1 w-8 sm:w-7 flex items-center justify-center bg-gradient-to-r from-white via-white/90 to-transparent rounded-l-xl disabled:opacity-0 transition-opacity cursor-pointer"
                aria-label="Previous dates"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-4 sm:size-3.5 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => scrollStrip('right')}
                disabled={!canScrollRight}
                className="absolute right-0 top-0 bottom-1 w-8 sm:w-7 flex items-center justify-center bg-gradient-to-l from-white via-white/90 to-transparent rounded-r-xl disabled:opacity-0 transition-opacity cursor-pointer"
                aria-label="Next dates"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-4 sm:size-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {!date && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 pt-4 pb-2"
            >
              <HugeiconsIcon icon={Calendar01Icon} strokeWidth={2} className="size-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground/60">Pick a date to see available times</p>
            </motion.div>
          )}

          {date && loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="h-4 w-24 rounded-md bg-muted animate-skeleton" />
                <div className="h-4 w-12 rounded-full bg-muted animate-skeleton" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <SlotSkeleton key={i} />
              ))}
            </motion.div>
          )}

          {date && !loading && availableSlots.length > 0 && (
            <motion.div
              key="slots"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available times</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">{availableSlots.length} slot{availableSlots.length > 1 ? 's' : ''}</Badge>
              </div>

              {grouped.map(({ period, slots: periodSlots }) => (
                <div key={period} className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-foreground">{periodConfig[period].label}</p>
                    <p className="text-[11px] text-muted-foreground/50">{periodConfig[period].range}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {periodSlots.map((slot) => {
                      const isSelected = selectedSlot === slot.id;
                      return (
                        <motion.button
                          key={slot.id}
                          type="button"
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => handleSlotClick(slot)}
                          className={cn(
                            'relative flex items-center justify-center w-full text-center rounded-xl border px-3 sm:px-2.5 py-3 sm:py-2.5 transition-all overflow-hidden',
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-white text-foreground border-foreground/10 hover:border-primary/40 active:scale-[0.98]',
                          )}
                        >
                          <span className={cn('text-xs font-medium', isSelected && 'text-white')}>
                            {slot.start_time.slice(0, 5)} — {slot.end_time.slice(0, 5)}
                          </span>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-white flex items-center justify-center shadow-xs"
                            >
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="size-2.5 text-primary" />
                            </motion.div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {unavailableCount > 0 && (
                <p className="text-xs text-muted-foreground/40 text-center pt-1">
                  {unavailableCount} of {slots.length} slot{slots.length > 1 ? 's' : ''} already booked
                </p>
              )}
            </motion.div>
          )}

          {date && !loading && availableSlots.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 rounded-xl bg-white border-2 border-dashed border-foreground/10 py-10 px-4"
            >
              <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No available slots for this date</p>
              <p className="text-xs text-muted-foreground/60">Try selecting a different date</p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
