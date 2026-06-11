import { useState, useEffect } from 'react';
import { api, Doctor, SlotResponse } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/Button';
import { SlotPicker } from '@/components/SlotPicker';
import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon, Cancel01Icon, ArrowRight01Icon, Calendar01Icon, ArrowRight03Icon } from '@hugeicons/core-free-icons';

interface ScheduleModalProps {
  open: boolean;
  patientId: string;
  patientName: string;
  currentDoctorId: string;
  currentDoctorName: string;
  onClose: () => void;
  onScheduled: () => void;
  forcedType?: 'follow-up' | 'referral';
}

export function ScheduleModal({ open, patientId, patientName, currentDoctorId, currentDoctorName, onClose, onScheduled, forcedType }: ScheduleModalProps) {
  const { token } = useAuth();
  const [step, setStep] = useState(1);
  const [scheduleType, setScheduleType] = useState<'follow-up' | 'referral'>('follow-up');
  const [knownDoctors, setKnownDoctors] = useState<Doctor[]>([]);
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

  const targetDoctorId = scheduleType === 'follow-up' ? currentDoctorId : selectedDoctorId;

  useEffect(() => {
    if (!open) return;
    const forced = forcedType;
    setScheduleType(forced || 'follow-up');
    setStep(forced === 'referral' ? 2 : forced === 'follow-up' ? 3 : 1);
    setSelectedDoctorId('');
    setSelectedDate('');
    setSelectedSlot(null);
    setNotes('');
    setError('');
    api.getPatientDoctors(patientId, token).then(setKnownDoctors).catch(() => {});
  }, [open, patientId, token, forcedType]);

  useEffect(() => {
    if (!open || !targetDoctorId) return;
    setDatesLoading(true);
    setSelectedDate('');
    setSelectedSlot(null);
    setSlots([]);
    setError('');
    api.getAvailableDoctorDates(targetDoctorId, token, false)
      .then(res => { setAvailableDates(res.dates); if (res.dates.length > 0) setSelectedDate(res.dates[0]); })
      .catch(() => setError('Failed to load available dates'))
      .finally(() => setDatesLoading(false));
  }, [open, targetDoctorId, token]);

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

  const selectedSlotData = !saving && slots.find(s => s.id === selectedSlot);
  const eligibleForReferral = knownDoctors.filter(d => d.id !== currentDoctorId);

  const handleSave = async () => {
    if (!selectedSlotData || !targetDoctorId) return;
    setSaving(true); setError('');
    try {
      await api.createAppointment({
        patient_id: patientId, doctor_id: targetDoctorId,
        slot_date: selectedSlotData.slot_date,
        start_time: selectedSlotData.start_time,
        end_time: selectedSlotData.end_time,
        notes: notes || undefined,
      }, token);
      onScheduled(); onClose();
    } catch (e: any) { setError(e.message || 'Failed'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button onClick={() => {
                if (step === 4) { setStep(3); return; }
                if (step === 3 && scheduleType === 'follow-up') { 
                  if (forcedType) { onClose(); return; }
                  setStep(1); return;
                }
                if (step === 2 && forcedType === 'referral') { onClose(); return; }
                setStep(s => s - 1);
                setSelectedSlot(null); setError('');
              }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <HugeiconsIcon icon={ArrowRight03Icon} className="size-4 rotate-180" />
              </button>
            )}
            <h3 className="text-lg font-bold text-slate-900">
            {forcedType === 'referral' ? 'Refer Patient' : forcedType === 'follow-up' ? 'Schedule Follow-up' : 'Create Appointment'}
          </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
            {step === 1 ? 'Type' : step === 2 ? 'Doctor' : step === 3 ? 'Schedule' : 'Confirm'}
          </span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`rounded-full transition-all duration-300 ${
                  step === s ? 'size-2 bg-primary' :
                  i < step - 1 ? 'size-2 bg-primary/30' : 'size-1.5 bg-muted-foreground/15'
                }`} />
                {i < 3 && (
                  <div className={`w-3 h-px transition-colors duration-300 ${step > s ? 'bg-primary/20' : 'bg-muted-foreground/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-5">
          <div className="text-sm font-medium text-slate-900">{patientName}</div>
          <div className="text-xs text-slate-500 mt-0.5">Dr. {currentDoctorName}</div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50 mb-4">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => { setScheduleType('follow-up'); setStep(3); }}
              className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-slate-200 bg-white p-8 transition-all hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="size-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-6" />
              </div>
              <div className="text-center">
                <div className="text-base font-semibold text-slate-900">Follow-up</div>
                <div className="text-sm text-slate-500 mt-1">Same doctor</div>
              </div>
            </button>
            <button type="button" onClick={() => { setScheduleType('referral'); setStep(2); }}
              className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-slate-200 bg-white p-8 transition-all hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
            >
              <div className="size-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 gap-0.5 group-hover:bg-emerald-100 transition-colors">
                <HugeiconsIcon icon={Calendar01Icon} className="size-5" />
                <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 text-emerald-400 -ml-0.5" />
                <HugeiconsIcon icon={Calendar01Icon} className="size-5" />
              </div>
              <div className="text-center">
                <div className="text-base font-semibold text-slate-900">Referral</div>
                <div className="text-sm text-slate-500 mt-1">Different doctor</div>
              </div>
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            {eligibleForReferral.length === 0 ? (
              <div className="text-sm text-slate-400 py-8 text-center bg-slate-50 rounded-lg">
                This patient has no history with other doctors.
              </div>
            ) : (
              <div className="space-y-1.5">
                {eligibleForReferral.map(d => (
                  <button key={d.id} type="button" onClick={() => { setSelectedDoctorId(d.id); setStep(3); }}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                      selectedDoctorId === d.id
                        ? 'border-emerald-400 bg-emerald-50/50'
                        : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                      {d.first_name[0]}{d.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">Dr. {d.first_name} {d.last_name}</div>
                      <div className="text-xs text-slate-500">{d.specialization}</div>
                    </div>
                    <div className="ml-auto shrink-0">
                      <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-2">
                {scheduleType === 'follow-up' ? 'Follow-up with' : 'Refer to'} <span className="font-semibold text-slate-800">
                  Dr. {scheduleType === 'follow-up' ? currentDoctorName : knownDoctors.find(d => d.id === selectedDoctorId)?.last_name || ''}
                </span>
              </label>
            </div>

            <SlotPicker
              dates={availableDates}
              slots={slots}
              datesLoading={datesLoading}
              slotsLoading={slotsLoading}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              onSelectDate={setSelectedDate}
              onSelectSlot={setSelectedSlot}
              emptyDatesMessage="No available dates."
              emptySlotsMessage="No available slots."
            />
          </div>
        )}

        {step === 4 && (
          <div>
            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Appointment Summary</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Patient</span>
                <span className="font-medium text-slate-900">{patientName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Doctor</span>
                <span className="font-medium text-slate-900">
                  Dr. {scheduleType === 'follow-up' ? currentDoctorName : knownDoctors.find(d => d.id === selectedDoctorId)?.last_name || ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Date</span>
                <span className="font-medium text-slate-900">
                  {selectedSlotData ? new Date(selectedSlotData.slot_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Time</span>
                <span className="font-medium text-slate-900">
                  {selectedSlotData ? `${selectedSlotData.start_time.slice(0, 5)} — ${selectedSlotData.end_time.slice(0, 5)}` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Type</span>
                <span className={`font-medium capitalize ${scheduleType === 'referral' ? 'text-sky-600' : 'text-emerald-600'}`}>
                  {scheduleType === 'referral' ? 'Referral' : 'Follow-up'}
                </span>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={scheduleType === 'referral' ? 'Reason for referral...' : 'Follow-up notes...'}
                rows={3}
                className="h-24 px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full resize-none"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => { if (scheduleType === 'follow-up') setStep(1); else setStep(2); setSelectedSlot(null); setError(''); }}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={() => selectedSlot && setStep(4)} disabled={!selectedSlot || (scheduleType === 'referral' && !selectedDoctorId)}>
                Continue
              </Button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => { setStep(3); setError(''); }}
              className="text-sm text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>
                {scheduleType === 'referral' ? 'Create Referral' : 'Schedule Follow-up'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
