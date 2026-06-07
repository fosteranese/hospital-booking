import { useState, useEffect, useRef } from 'react';
import { api, SlotResponse } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Cancel01Icon, CheckmarkCircle01Icon, ArrowLeft01Icon, ArrowRight01Icon, Calendar01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

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

interface ScheduleModalProps {
  open: boolean;
  patientId: string;
  patientName: string;
  currentDoctorId: string;
  currentDoctorName: string;
  onClose: () => void;
  onScheduled: () => void;
}

interface DoctorOption {
  id: string;
  name: string;
  specialization: string;
}

export function ScheduleModal({ open, patientId, patientName, currentDoctorId, currentDoctorName, onClose, onScheduled }: ScheduleModalProps) {
  const { token } = useAuth();
  const stripRef = useRef<HTMLDivElement>(null);
  const [scheduleType, setScheduleType] = useState<'follow-up' | 'referral'>('follow-up');
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<SlotResponse[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    setTimeout(checkScroll, 100);
  };

  const targetDoctorId = scheduleType === 'follow-up' ? currentDoctorId : selectedDoctorId;

  // Fetch doctors list
  useEffect(() => {
    if (!open) return;
    api.getDoctors().then(data => {
      setDoctors(data.map(d => ({ id: d.id, name: `${d.first_name} ${d.last_name}`, specialization: d.specialization })));
    }).catch(() => {});
  }, [open]);

  // Fetch available dates when doctor changes
  useEffect(() => {
    if (!open || !targetDoctorId) return;
    setDatesLoading(true);
    setSelectedDate('');
    setSelectedSlot(null);
    setSlots([]);
    setError('');
    api.getAvailableDoctorDates(targetDoctorId, token, false)
      .then(res => {
        setAvailableDates(res.dates);
        if (res.dates.length > 0) setSelectedDate(res.dates[0]);
      })
      .catch(() => setError('Failed to load available dates'))
      .finally(() => { setDatesLoading(false); setTimeout(checkScroll, 50); });
  }, [open, targetDoctorId, token]);

  useEffect(() => { checkScroll(); }, [availableDates]);

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDate || !targetDoctorId) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    api.getDoctorAvailability(targetDoctorId, selectedDate, token, false)
      .then(data => setSlots(data.filter(s => !s.is_booked && !s.is_blocked)))
      .catch(() => setError('Failed to load available slots'))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, targetDoctorId, token]);

  if (!open) return null;

  const groupedSlots = groupSlotsByPeriod(slots);
  const selectedSlotData = slots.find(s => s.id === selectedSlot);

  const handleSave = async () => {
    if (!selectedSlotData || !targetDoctorId) return;
    setSaving(true);
    setError('');
    try {
      await api.createAppointment({
        patient_id: patientId,
        doctor_id: targetDoctorId,
        slot_date: selectedSlotData.slot_date,
        start_time: selectedSlotData.start_time,
        end_time: selectedSlotData.end_time,
        notes: notes || undefined,
      }, token);
      onScheduled();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create appointment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-900">Schedule New Appointment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        {/* Patient info */}
        <div className="bg-slate-50 rounded-xl p-4 mb-5">
          <div className="text-sm font-medium text-slate-900">{patientName}</div>
          <div className="text-xs text-slate-500 mt-0.5">Current doctor: Dr. {currentDoctorName}</div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50 mb-4">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Type selection */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 mb-2">Type</label>
          <div className="flex gap-2 p-0.5 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => { setScheduleType('follow-up'); setSelectedSlot(null); setError(''); }}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all ${
                scheduleType === 'follow-up' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Follow-up
            </button>
            <button
              type="button"
              onClick={() => { setScheduleType('referral'); setSelectedSlot(null); setError(''); }}
              className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-md transition-all ${
                scheduleType === 'referral' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Referral
            </button>
          </div>
        </div>

        {/* Doctor selection (referral only) */}
        {scheduleType === 'referral' && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-600 mb-2">Refer to doctor *</label>
            <select
              value={selectedDoctorId}
              onChange={e => { setSelectedDoctorId(e.target.value); setSelectedSlot(null); setError(''); }}
              className="h-11 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full"
            >
              <option value="">Select a doctor...</option>
              {doctors.filter(d => d.id !== currentDoctorId).map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date strip */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 mb-2">Select date</label>
          {datesLoading ? (
            <div className="h-[68px] bg-slate-100 rounded-xl animate-pulse" />
          ) : availableDates.length === 0 ? (
            <div className="text-sm text-slate-400 py-3 text-center bg-slate-50 rounded-lg">
              {targetDoctorId ? 'No available dates for this doctor.' : 'Select a doctor first.'}
            </div>
          ) : (
            <div className="relative">
              <div ref={stripRef} onScroll={checkScroll} className="flex gap-2 overflow-x-auto scroll-smooth no-scrollbar pb-1 overscroll-x-contain">
                {availableDates.map(d => {
                  const dt = new Date(d + 'T12:00:00');
                  const dayName = dt.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = dt.getDate();
                  const month = dt.toLocaleDateString('en-US', { month: 'short' });
                  const isSelected = d === selectedDate;
                  return (
                    <button key={d} type="button" onClick={() => setSelectedDate(d)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 min-w-[56px] sm:min-w-[68px] py-2.5 sm:py-3 px-2 sm:px-2.5 rounded-xl border transition-all shrink-0',
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-primary/40 hover:text-primary',
                      )}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">{dayName}</span>
                      <span className="text-lg sm:text-xl font-semibold leading-tight">{dayNum}</span>
                      <span className="text-[10px] font-medium opacity-70">{month}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => scrollStrip('left')} disabled={!canScrollLeft}
                className="absolute left-0 top-0 bottom-1 w-10 flex items-center justify-center rounded-l-xl disabled:opacity-0 transition-opacity cursor-pointer bg-white/80 hover:bg-white shadow-[2px_0_8px_-4px_rgba(0,0,0,0.15)] z-10"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5 text-slate-600" />
              </button>
              <button type="button" onClick={() => scrollStrip('right')} disabled={!canScrollRight}
                className="absolute right-0 top-0 bottom-1 w-10 flex items-center justify-center rounded-r-xl disabled:opacity-0 transition-opacity cursor-pointer bg-white/80 hover:bg-white shadow-[-2px_0_8px_-4px_rgba(0,0,0,0.15)] z-10"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 text-slate-600" />
              </button>
            </div>
          )}
        </div>

        {/* Slot grid */}
        {selectedDate && targetDoctorId && (
          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-600 mb-2">Select time</label>
            {slotsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : groupedSlots.length === 0 ? (
              <div className="text-sm text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No available slots for this date.</div>
            ) : (
              <div className="space-y-4">
                {groupedSlots.map(({ period, slots: periodSlots }) => (
                  <div key={period} className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-800">{periodConfig[period].label}</span>
                      <span className="text-[11px] text-slate-400">{periodConfig[period].range}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {periodSlots.map(slot => {
                        const isSelected = selectedSlot === slot.id;
                        return (
                          <button key={slot.id} type="button" onClick={() => setSelectedSlot(slot.id)}
                            className={cn(
                              'relative flex items-center justify-center w-full text-center rounded-xl border px-2 py-2.5 transition-all overflow-hidden',
                              isSelected
                                ? 'bg-primary text-white border-primary shadow-xs'
                                : 'bg-white text-slate-800 border-slate-200 hover:border-primary/40 active:scale-[0.98]',
                            )}
                          >
                            <span className={cn('text-xs font-medium', isSelected && 'text-white')}>
                              {slot.start_time.slice(0, 5)} — {slot.end_time.slice(0, 5)}
                            </span>
                            {isSelected && (
                              <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-white flex items-center justify-center shadow-xs">
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

        {/* Notes */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder={scheduleType === 'referral' ? 'Reason for referral...' : 'Follow-up notes...'}
            rows={2}
            className="h-11 px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!selectedSlot || (scheduleType === 'referral' && !selectedDoctorId)}>
            {scheduleType === 'referral' ? 'Refer Patient' : 'Schedule'}
          </Button>
        </div>
      </div>
    </div>
  );
}
