import { useState, useEffect, useCallback, Fragment } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Clock01Icon,
  Add01Icon,
  Delete01Icon,
  AlertCircleIcon,
  Calendar02Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

const inputClass = "h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all";

interface UnavailRecord {
  id: string;
  slot_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  conflict_count: number;
}

export function DoctorUnavailabilityPage() {
  const { token } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [unavail, setUnavail] = useState<UnavailRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [isFullDay, setIsFullDay] = useState(true);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Resolve prompt
  const [resolvePrompt, setResolvePrompt] = useState<{ id: string; count: number } | null>(null);

  // Expanded row + conflicts
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Record<string, AppointmentHistoryItem[]>>({});
  const [conflictsLoading, setConflictsLoading] = useState<string | null>(null);

  // Inline reschedule
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      try {
        const profile: any = await api.getProfile(token);
        if (profile.doctor_id) setDoctorId(profile.doctor_id);
      } catch { /* ignore */ }
      finally { setProfileLoading(false); }
    })();
  }, [token]);

  const fetchUnavailability = useCallback(async () => {
    if (!doctorId) return;
    setLoading(true);
    try {
      const data = await api.getDoctorUnavailability(doctorId, token);
      setUnavail(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [doctorId, token]);

  useEffect(() => {
    if (doctorId) fetchUnavailability();
  }, [doctorId, fetchUnavailability]);

  const fetchConflicts = async (unavailId: string) => {
    if (!doctorId) return;
    setConflictsLoading(unavailId);
    try {
      const data = await api.getUnavailabilityConflicts(doctorId, unavailId, token);
      setConflicts(prev => ({ ...prev, [unavailId]: data }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setConflictsLoading(null);
    }
  };

  const handleToggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!conflicts[id]) fetchConflicts(id);
    }
  };

  const handleCreate = async () => {
    if (!newDate || !doctorId) return;
    if (!isFullDay && (!newStart || !newEnd)) { setError('Please enter both start and end times for a time range.'); return; }
    setSaving(true);
    setError('');
    try {
      const record = await api.createDoctorUnavailability(doctorId, {
        slot_date: newDate,
        start_time: newStart || undefined,
        end_time: newEnd || undefined,
        reason: newReason || undefined,
      }, token);
      setNewDate(''); setNewStart(''); setNewEnd(''); setNewReason('');
      fetchUnavailability();
      setShowModal(false);
      if (record.conflict_count > 0) {
        setResolvePrompt({ id: record.id, count: record.conflict_count });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!doctorId) return;
    try {
      await api.deleteDoctorUnavailability(doctorId, id, token);
      setUnavail(prev => prev.filter(u => u.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleReschedule = async (appointmentId: string) => {
    if (!rescheduleDate || !rescheduleTime || !doctorId) return;
    setRescheduling(appointmentId);
    try {
      const [h, m] = rescheduleTime.split(':');
      const endH = String(parseInt(h) + 1).padStart(2, '0');
      await api.rescheduleAppointmentToTime(appointmentId, {
        slot_date: rescheduleDate,
        start_time: rescheduleTime,
        end_time: `${endH}:${m}`,
        doctor_id: doctorId,
      }, token);
      // Remove from conflicts list + decrement count
      const currentUnavailId = expandedId;
      if (currentUnavailId) {
        setConflicts(prev => ({
          ...prev,
          [currentUnavailId]: prev[currentUnavailId].filter(a => a.id !== appointmentId),
        }));
        setUnavail(prev => prev.map(u =>
          u.id === currentUnavailId ? { ...u, conflict_count: Math.max(0, u.conflict_count - 1) } : u
        ));
        setResolvePrompt(null);
      }
      setRescheduling(null);
      setRescheduleDate('');
      setRescheduleTime('');
    } catch (e: any) {
      setError(e.message);
      setRescheduling(null);
    }
  };

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Unavailability" description="Manage your time off and blackout periods" icon={Clock01Icon} />
        <div className="bg-white rounded-xl border border-slate-200/80 p-8">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!doctorId) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Unavailability" description="Manage your time off and blackout periods" icon={Clock01Icon} />
        <Card>
          <EmptyState
            icon={Clock01Icon}
            title="Doctor profile not found"
            description="Your account is not linked to a doctor profile. Please contact an administrator."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="My Unavailability"
          description="Manage your time off and blackout periods"
          icon={Clock01Icon}
        />
        <Button onClick={() => { setShowModal(true); setIsFullDay(true); setNewStart(''); setNewEnd(''); }} icon={Add01Icon} className="shrink-0 mt-1.5">
          Add Unavailability
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Resolve prompt banner */}
      {resolvePrompt && (
        <div className="flex items-center justify-between gap-4 text-sm text-amber-800 bg-amber-50 px-5 py-3.5 rounded-lg ring-1 ring-amber-200/60">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            <span>There {resolvePrompt.count === 1 ? 'is' : 'are'} <strong>{resolvePrompt.count}</strong> appointment{resolvePrompt.count !== 1 ? 's' : ''} that conflict with this unavailability.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => { setExpandedId(resolvePrompt.id); if (!conflicts[resolvePrompt.id]) fetchConflicts(resolvePrompt.id); setResolvePrompt(null); }}>
              Resolve Conflicts
            </Button>
            <button onClick={() => setResolvePrompt(null)} className="p-1.5 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-100 transition-colors">
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
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
            description="You have no blackout periods set."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Time</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Reason</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Conflicts</th>
                  <th className="w-16 px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {unavail.map((u) => (
                  <Fragment key={u.id}>
                    <tr
                      className="cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md"
                      onClick={() => handleToggleExpand(u.id)}
                      style={{ transformOrigin: 'center' }}
                    >
                      <td className="px-5 py-3.5 text-sm font-medium text-slate-900">{u.slot_date}</td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">
                        {u.start_time && u.end_time
                          ? `${formatTime(u.start_time)} – ${formatTime(u.end_time)}`
                          : <span className="italic text-slate-400">All day</span>}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">{u.reason || '—'}</td>
                      <td className="px-5 py-3.5">
                        {u.conflict_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                            <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
                            {u.conflict_count}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
                            None
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(u.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <HugeiconsIcon icon={Delete01Icon} className="size-4 text-red-500" />
                        </button>
                      </td>
                    </tr>
                    {/* Expanded conflict rows */}
                    {expandedId === u.id && (
                      <tr>
                        <td colSpan={5} className="px-0 py-0">
                          <div className="bg-slate-50/80 border-t border-slate-100">
                            {conflictsLoading === u.id ? (
                              <div className="px-8 py-4 space-y-2">
                                {[1, 2].map(i => <div key={i} className="h-10 bg-slate-100 rounded-md animate-pulse" />)}
                              </div>
                            ) : conflicts[u.id]?.length > 0 ? (
                              <div>
                                <div className="px-8 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                  Conflicting Appointments ({conflicts[u.id].length})
                                </div>
                                {conflicts[u.id].map(a => {
                                  const isRescheduling = rescheduling === a.id;
                                  return (
                                    <div key={a.id} className="flex items-center gap-3 px-8 py-2.5 border-b border-slate-100 last:border-b-0">
                                      <div className="size-7 rounded-full bg-amber-50 flex items-center justify-center text-[10px] font-semibold text-amber-600 shrink-0">
                                        {(a.patient_name || 'P').split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="text-sm font-medium text-slate-900 truncate">{a.patient_name}</div>
                                        <div className="text-xs text-slate-400">
                                          {new Date(a.slot_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                          {' · '}{formatTime(a.start_time)} — {formatTime(a.end_time)}
                                        </div>
                                      </div>
                                      <div className="shrink-0">
                                        {isRescheduling ? (
                                          <div className="flex items-center gap-1.5">
                                            <input type="date" value={rescheduleDate} min={today} onChange={e => setRescheduleDate(e.target.value)} className={`${inputClass} w-[130px]`} />
                                            <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className={`${inputClass} w-[100px]`} />
                                            <Button size="sm" onClick={() => handleReschedule(a.id)} loading={false} disabled={!rescheduleDate || !rescheduleTime}>Save</Button>
                                            <button onClick={() => { setRescheduling(null); setRescheduleDate(''); setRescheduleTime(''); }} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                                              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 rotate-180" />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => setRescheduling(a.id)}
                                            className="text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors"
                                          >
                                            Reschedule
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="px-8 py-4 text-xs text-slate-400">No conflicting appointments found.</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900">Add Unavailability</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Date *</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={today} className={`${inputClass} w-full`} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Type</label>
                <div className="flex gap-2 p-0.5 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => { setIsFullDay(true); setNewStart(''); setNewEnd(''); }}
                    className={`flex-1 py-2 px-4 text-xs font-medium rounded-md transition-all ${
                      isFullDay ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Full Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFullDay(false)}
                    className={`flex-1 py-2 px-4 text-xs font-medium rounded-md transition-all ${
                      !isFullDay ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Time Range
                  </button>
                </div>
              </div>
              {!isFullDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Start time *</label>
                    <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className={`${inputClass} w-full`} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">End time *</label>
                    <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className={`${inputClass} w-full`} />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Reason</label>
                <input type="text" value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g. Annual leave" className={`${inputClass} w-full`} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleCreate} loading={saving} disabled={!newDate}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
