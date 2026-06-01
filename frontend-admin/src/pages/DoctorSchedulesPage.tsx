import { useState, useEffect } from 'react';
import { api, Doctor, DoctorSchedule } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { TimeScheduleIcon, AlertCircleIcon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DayEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  enabled: boolean;
}

const inputClass = "h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all";

export function DoctorSchedulesPage() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [schedules, setSchedules] = useState<DayEntry[]>(
    DAY_NAMES.map((_, i) => ({ day_of_week: i, start_time: '09:00', end_time: '17:00', enabled: i < 5 }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getDoctors().then(setDoctors).catch(() => {});
  }, []);

  const fetchSchedules = async () => {
    if (!selectedDoctorId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getDoctorSchedules(selectedDoctorId, token);
      const entries: DayEntry[] = DAY_NAMES.map((_, i) => {
        const found = data.find(s => s.day_of_week === i);
        return {
          day_of_week: i,
          start_time: found?.start_time || '09:00',
          end_time: found?.end_time || '17:00',
          enabled: !!found,
        };
      });
      setSchedules(entries);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSchedules(); }, [selectedDoctorId]);

  const handleSave = async () => {
    if (!selectedDoctorId) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const active = schedules.filter(s => s.enabled).map(s => ({
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
      }));
      await api.setDoctorSchedules(selectedDoctorId, active, token);
      setSuccess('Schedules saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (idx: number) => {
    setSchedules(prev => prev.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Doctor Schedules"
        description="Set per-doctor working hours"
        icon={TimeScheduleIcon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg ring-1 ring-emerald-200/50">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
          {success}
        </div>
      )}

      <Card>
        <CardHeader title="Select Doctor" description="Choose a doctor to configure their schedule" />
        <select
          value={selectedDoctorId}
          onChange={(e) => setSelectedDoctorId(e.target.value)}
          className={`${inputClass} w-[300px]`}
        >
          <option value="">Choose a doctor</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>
          ))}
        </select>
      </Card>

      {selectedDoctorId && (
        <Card>
          <CardHeader title="Weekly Schedule" description="Configure working hours for each day" />
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((entry, idx) => (
                <div key={idx} className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${entry.enabled ? 'bg-slate-50' : 'bg-transparent'}`}>
                  <label className="flex items-center gap-2.5 w-32 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.enabled}
                      onChange={() => toggleDay(idx)}
                      className="rounded border-slate-300 size-4 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className={`text-sm font-medium ${entry.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                      {DAY_NAMES[idx]}
                    </span>
                  </label>
                  {entry.enabled ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={entry.start_time}
                        onChange={(e) => setSchedules(prev => prev.map((s, i) => i === idx ? { ...s, start_time: e.target.value } : s))}
                        className={`${inputClass} w-[130px]`}
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="time"
                        value={entry.end_time}
                        onChange={(e) => setSchedules(prev => prev.map((s, i) => i === idx ? { ...s, end_time: e.target.value } : s))}
                        className={`${inputClass} w-[130px]`}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400 italic">Day off</span>
                  )}
                </div>
              ))}
              <div className="pt-4">
                <Button onClick={handleSave} loading={saving}>
                  Save Schedules
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
