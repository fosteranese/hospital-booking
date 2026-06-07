import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Clock01Icon, AlertCircleIcon, Cancel01Icon } from '@hugeicons/core-free-icons';

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

interface RescheduleModalProps {
  open: boolean;
  appointment: { id: string; patient_name: string; slot_date: string; start_time: string; end_time: string } | null;
  onClose: () => void;
  onResolved: () => void;
}

const inputClass = "h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all";

export function RescheduleModal({ open, appointment, onClose, onResolved }: RescheduleModalProps) {
  const { token } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open || !appointment) return null;

  const handleSave = async () => {
    if (!rescheduleDate || !rescheduleTime) return;
    setSaving(true);
    setError('');
    try {
      const [h, m] = rescheduleTime.split(':');
      const endH = String(parseInt(h) + 1).padStart(2, '0');
      await api.rescheduleAppointmentToTime(appointment.id, {
        slot_date: rescheduleDate,
        start_time: rescheduleTime,
        end_time: `${endH}:${m}`,
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
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
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

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">New date *</label>
            <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} min={today} className={`${inputClass} w-full`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">New time *</label>
            <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className={`${inputClass} w-full`} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!rescheduleDate || !rescheduleTime}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
