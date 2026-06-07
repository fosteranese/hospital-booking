import { useState, useEffect } from 'react';
import { api, SlotResponse } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Clock01Icon, AlertCircleIcon, Cancel01Icon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
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

interface RescheduleModalProps {
  open: boolean;
  appointment: { id: string; patient_name: string; slot_date: string; start_time: string; end_time: string; doctor_id: string; patient_id: string } | null;
  onClose: () => void;
  onResolved: () => void;
}

export function RescheduleModal({ open, appointment, onClose, onResolved }: RescheduleModalProps) {
  const { token } = useAuth();
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [datesLoading, setDatesLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<SlotResponse[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !appointment) return;
    setDatesLoading(true);
    setSelectedDate('');
    setSelectedSlot(null);
    setError('');
    api.getAvailableDoctorDates(appointment.doctor_id, token, true)
      .then(res => {
        setAvailableDates(res.dates);
        if (res.dates.length > 0) {
          setSelectedDate(res.dates[0]);
        }
      })
      .catch(() => setError('Failed to load available dates'))
      .finally(() => setDatesLoading(false));
  }, [open, appointment, token]);

  useEffect(() => {
    if (!selectedDate || !appointment) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    setError('');
    api.getDoctorAvailability(appointment.doctor_id, selectedDate, token, true)
      .then(data => {
        setSlots(data.filter(s => !s.is_booked && !s.is_blocked));
      })
      .catch(() => setError('Failed to load available slots'))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, appointment, token]);

  if (!open || !appointment) return null;

  const groupedSlots = groupSlotsByPeriod(slots);
  const selectedSlotData = slots.find(s => s.id === selectedSlot);

  const handleSave = async () => {
    if (!selectedSlotData) return;
    setSaving(true);
    setError('');
    try {
      await api.rescheduleAppointmentToTime(appointment.id, {
        slot_date: selectedSlotData.slot_date,
        start_time: selectedSlotData.start_time,
        end_time: selectedSlotData.end_time,
        doctor_id: appointment.doctor_id,
      }, token);
      onResolved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to reschedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-900">Reschedule Appointment</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        {/* Current appointment info */}
        <div className="bg-red-50 rounded-xl p-4 mb-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 uppercase tracking-wider">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5" />
            Conflicting Appointment
          </div>
          <div className="text-sm font-medium text-slate-900">{appointment.patient_name}</div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Calendar01Icon} className="size-3.5" />
              {formatDate(appointment.slot_date)}
            </span>
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
              {formatTime(appointment.start_time)} — {formatTime(appointment.end_time)}
            </span>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50 mb-4">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Date selection */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-600 mb-2">Select new date</label>
          {datesLoading ? (
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ) : availableDates.length === 0 ? (
            <div className="text-sm text-slate-400 py-3 text-center bg-slate-50 rounded-lg">No available dates found.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {availableDates.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-lg border transition-all',
                    selectedDate === d
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40 hover:text-slate-800'
                  )}
                >
                  {formatDate(d)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Slot grid */}
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
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlot(slot.id)}
                            className={cn(
                              'relative flex items-center justify-center w-full text-center rounded-xl border px-2 py-2.5 transition-all overflow-hidden',
                              isSelected
                                ? 'bg-primary text-white border-primary shadow-xs'
                                : 'bg-white text-slate-800 border-slate-200 hover:border-primary/40 active:scale-[0.98]'
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

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!selectedSlot}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
