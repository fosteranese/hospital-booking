import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Cancel01Icon } from '@hugeicons/core-free-icons';

const inputClass = "h-10 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full";

interface DoctorOption {
  id: string;
  name: string;
  specialization: string;
}

interface ReferralModalProps {
  open: boolean;
  patientId: string;
  patientName: string;
  onClose: () => void;
  onReferred: () => void;
}

export function ReferralModal({ open, patientId, patientName, onClose, onReferred }: ReferralModalProps) {
  const { token } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    api.getDoctors().then(data => {
      setDoctors(data.map(d => ({ id: d.id, name: `${d.first_name} ${d.last_name}`, specialization: d.specialization })));
    }).catch(() => {});
    setSelectedDoctorId('');
    setDate('');
    setStartTime('');
    setEndTime('');
    setNotes('');
    setError('');
  }, [open]);

  const handleSubmit = async () => {
    if (!selectedDoctorId || !date || !startTime || !endTime) return;
    if (startTime >= endTime) { setError('Start time must be before end time'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createAppointment({
        patient_id: patientId,
        doctor_id: selectedDoctorId,
        slot_date: date,
        start_time: startTime,
        end_time: endTime,
        notes: notes || undefined,
      }, token);
      onReferred();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to create referral');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-900">Refer Patient</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        <div className="bg-sky-50 rounded-xl p-4 mb-5">
          <div className="text-sm font-medium text-slate-900">{patientName}</div>
          <div className="text-xs text-sky-600 mt-1">Refer to another doctor</div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50 mb-4">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Doctor *</label>
            <select value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)} className={inputClass}>
              <option value="">Select a doctor...</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.specialization}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} min={today} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Start time *</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">End time *</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for referral..." rows={2} className={`${inputClass} resize-none`} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!selectedDoctorId || !date || !startTime || !endTime}>
            Create Referral
          </Button>
        </div>
      </div>
    </div>
  );
}
