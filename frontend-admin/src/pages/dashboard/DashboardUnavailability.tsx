import { useState, useEffect, useCallback } from 'react';
import { api, Doctor, DoctorUnavailability } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, Add01Icon, Delete01Icon, AlertCircleIcon, Calendar02Icon } from '@hugeicons/core-free-icons';


import { inputClass } from '@/lib/helpers';
export function DashboardUnavailability() {
  const { token, userRole } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [unavail, setUnavail] = useState<DoctorUnavailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getDoctors().then(setDoctors).catch(() => {});
  }, []);

  const fetchUnavailability = useCallback(async () => {
    if (!selectedDoctorId) { setUnavail([]); return; }
    setLoading(true);
    setError('');
    try {
      const data = await api.getDoctorUnavailability(selectedDoctorId, token);
      setUnavail(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load unavailability');
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, token]);

  useEffect(() => { fetchUnavailability(); }, [fetchUnavailability]);

  const handleCreate = async () => {
    if (!selectedDoctorId || !newDate) return;
    setSaving(true);
    setError('');
    try {
      await api.createDoctorUnavailability(selectedDoctorId, {
        slot_date: newDate,
        start_time: newStart || undefined,
        end_time: newEnd || undefined,
        reason: newReason || undefined,
      }, token);
      setNewDate('');
      setNewStart('');
      setNewEnd('');
      setNewReason('');
      await fetchUnavailability();
    } catch (e: any) {
      setError(e.message || 'Failed to create unavailability');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (unavailId: string) => {
    if (!selectedDoctorId) return;
    try {
      await api.deleteDoctorUnavailability(selectedDoctorId, unavailId, token);
      setUnavail(prev => prev.filter(u => u.id !== unavailId));
    } catch (e: any) {
      setError(e.message || 'Failed to delete unavailability');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Unavailability"
        description="Manage blackout periods and time off for doctors"
        icon={Clock01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader title="Select Doctor" description="Choose a doctor to manage their unavailability" />
        <select
          value={selectedDoctorId}
          onChange={(e) => setSelectedDoctorId(e.target.value)}
          className={`${inputClass} w-full sm:w-[300px]`}
        >
          <option value="">Choose a doctor</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name} — {d.specialization}</option>
          ))}
        </select>
      </Card>

      {selectedDoctorId && (
        <>
          <Card>
            <CardHeader title="Add Unavailability" description="Mark a doctor as unavailable for a specific date or time range" />
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Date *</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={`${inputClass} w-full sm:w-[170px]`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Start time</label>
                <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className={`${inputClass} w-full sm:w-[130px]`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">End time</label>
                <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className={`${inputClass} w-full sm:w-[130px]`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason</label>
                <input type="text" value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g. Annual leave" className={`${inputClass} w-full sm:w-[180px]`} />
              </div>
              <Button onClick={handleCreate} loading={saving} disabled={!newDate} icon={Add01Icon}>
                Add
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-3">Leave times empty for a full-day unavailability.</p>
          </Card>

          <Card padding="none">
            <div className="px-5 py-4 border-b border-slate-100">
              <CardHeader title={`Unavailability Records (${unavail.length})`} />
            </div>
            {loading ? (
              <div className="p-8">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            ) : unavail.length === 0 ? (
              <EmptyState
                icon={Calendar02Icon}
                title="No unavailability records"
                description="This doctor has no blackout periods configured."
              />
            ) : (
              <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Time</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Reason</th>
                      <th className="w-16 px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {unavail.map((u) => (
                      <tr key={u.id} className="transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md" style={{ transformOrigin: 'center' }}>
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{u.slot_date}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">
                          {u.start_time && u.end_time
                            ? `${u.start_time.slice(0, 5)} – ${u.end_time.slice(0, 5)}`
                            : <span className="text-slate-400 italic">All day</span>}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-500">{u.reason || '—'}</td>
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <HugeiconsIcon icon={Delete01Icon} className="size-4 text-red-500" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
