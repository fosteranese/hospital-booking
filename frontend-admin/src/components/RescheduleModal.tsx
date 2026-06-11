import { useState, useEffect } from 'react';
import { api, SlotResponse } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { Button } from '@/components/Button';
import { SlotPicker } from '@/components/SlotPicker';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Clock01Icon, AlertCircleIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { formatTime, formatDate } from '@/lib/helpers';

interface RescheduleModalProps {
  open: boolean;
  appointment: { id: string; patient_name: string; slot_date: string; start_time: string; end_time: string; doctor_id: string; patient_id: string; has_conflict?: boolean } | null;
  onClose: () => void;
  onResolved: () => void;
}

export function RescheduleModal({ open, appointment, onClose, onResolved }: RescheduleModalProps) {
  const { token } = useAuth();
  const { addToast } = useToast();
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
      addToast('Appointment rescheduled successfully', 'success');
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-900">Reschedule Appointment</h3>
          <button onClick={onClose} data-close-modal aria-label="Close modal" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        <div className={`rounded-xl p-4 mb-5 space-y-2 ${appointment.has_conflict ? 'bg-red-50' : 'bg-slate-50'}`}>
          <div className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${appointment.has_conflict ? 'text-red-600' : 'text-slate-500'}`}>
            <HugeiconsIcon icon={appointment.has_conflict ? AlertCircleIcon : Calendar01Icon} className="size-3.5" />
            {appointment.has_conflict ? 'Conflicting Appointment' : 'Reschedule Appointment'}
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

        <SlotPicker
          dates={availableDates}
          slots={slots}
          datesLoading={datesLoading}
          slotsLoading={slotsLoading}
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          onSelectDate={setSelectedDate}
          onSelectSlot={setSelectedSlot}
        />

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
