import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';
import { useDoctors } from '@/hooks/useDoctors';
import { api } from '../lib/api';

interface CreateAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: {
    patient_id: string;
    doctor_id: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    notes?: string;
  }) => Promise<void>;
  selectedDate?: Date;
  selectedStartTime?: string;
  token: string;
}

interface DoctorOption {
  id: string;
  name: string;
  specialization: string;
}

interface PatientResult {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export function CreateAppointmentModal({ open, onClose, onCreate, selectedDate, selectedStartTime, token }: CreateAppointmentModalProps) {
  const { doctors: doctorList } = useDoctors();
  const [patientQuery, setPatientQuery] = useState('');
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [date, setDate] = useState(selectedDate ? selectedDate.toISOString().split('T')[0] : '');
  const [startTime, setStartTime] = useState(selectedStartTime || '');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const doctors = doctorList.map(d => ({
    id: d.id, name: `${d.first_name} ${d.last_name}`, specialization: d.specialization || '',
  }));

  const [showPatientSearch, setShowPatientSearch] = useState(true);

  const searchPatients = async (q: string) => {
    if (q.length < 2) { setPatientResults([]); return; }
    setSearching(true);
    try {
      const res = await api.searchPatients(q, token);
      setPatientResults(res.map((p: { id: string; first_name: string; last_name: string; phone: string; email: string }) => ({
        id: p.id, name: `${p.first_name} ${p.last_name}`, phone: p.phone, email: p.email,
      })));
    } catch {
      setPatientResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleOpen = async () => {
    setSelectedPatient(null);
    setPatientQuery('');
    setPatientResults([]);
    setSelectedDoctorId('');
    setNotes('');
    setEndTime('');
    setShowPatientSearch(true);
    if (selectedDate) setDate(selectedDate.toISOString().split('T')[0]);
    if (selectedStartTime) setStartTime(selectedStartTime);
  };

  if (!open) return null;

  const handleSubmit = async () => {
    if (!selectedPatient || !selectedDoctorId || !date || !startTime || !endTime) return;
    setCreating(true);
    try {
      await onCreate({
        patient_id: selectedPatient.id,
        doctor_id: selectedDoctorId,
        slot_date: date,
        start_time: startTime,
        end_time: endTime,
        notes: notes || undefined,
      });
      onClose();
    } finally {
      setCreating(false);
    }
  };

  const valid = selectedPatient && selectedDoctorId && date && startTime && endTime && startTime < endTime;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm dark:bg-black/70" />
      <div
        className="relative bg-card rounded-2xl shadow-2xl ring-1 ring-border w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">New Appointment</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground">
            <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {showPatientSearch ? (
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Patient</label>
              <div className="relative">
                <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    searchPatients(e.target.value);
                  }}
                  placeholder="Search patients by name, phone, or email..."
                  className="w-full rounded-lg border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {searching && <div className="text-xs text-muted-foreground mt-1">Searching...</div>}
              {patientResults.length > 0 && (
                <div className="mt-2 border border-border rounded-lg max-h-48 overflow-y-auto">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPatient(p);
                        setShowPatientSearch(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                    >
                      <div className="text-sm font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.phone}{p.email ? ` · ${p.email}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Patient</label>
                <button onClick={() => setShowPatientSearch(true)} className="text-xs text-primary hover:underline">Change</button>
              </div>
              <div className="bg-accent/40 rounded-lg px-3 py-2">
                <div className="text-sm font-semibold text-foreground">{selectedPatient?.name}</div>
                <div className="text-xs text-muted-foreground">{selectedPatient?.phone}{selectedPatient?.email ? ` · ${selectedPatient?.email}` : ''}</div>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Doctor</label>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select a doctor...</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.specialization ? ` (${d.specialization})` : ''}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {startTime && endTime && startTime >= endTime && (
            <p className="text-xs text-red-500">End time must be after start time.</p>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Any additional notes..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm font-medium text-foreground bg-accent rounded-lg hover:bg-accent/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || creating}
            className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}
