import { useState, useEffect, useCallback, Fragment } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/ui/input';
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

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const inputClass = "h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all";
const smallInputClass = inputClass;

interface UnavailRecord {
  id: string;
  slot_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  conflict_count?: number;
}

export function DoctorUnavailabilityPage() {
  const { token } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [unavail, setUnavail] = useState<UnavailRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'past'>('all');

  // Add modal state
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [isDateRange, setIsDateRange] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [isFullDay, setIsFullDay] = useState(true);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Conflict warning modal (separate overlay)
  const [conflictWarning, setConflictWarning] = useState<{ count: number } | null>(null);

  // Delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setConflictWarning(null);
    const endDate = isDateRange ? newEndDate : undefined;
    if (isDateRange && !newEndDate) { setError('Please enter an end date for the range.'); setSaving(false); return; }
    try {
      const { conflict_count } = await api.checkUnavailabilityConflicts(doctorId, {
        slot_date: newDate,
        end_date: endDate,
        start_time: isFullDay ? undefined : newStart,
        end_time: isFullDay ? undefined : newEnd,
      }, token);
      if (conflict_count > 0) {
        setConflictWarning({ count: conflict_count });
        setSaving(false);
        return;
      }
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
      return;
    }
    await handleCreateConfirmed();
  };

  const handleCreateConfirmed = async () => {
    if (!newDate || !doctorId) return;
    setSaving(true);
    const endDate = isDateRange ? newEndDate : undefined;
    try {
      const record = await api.createDoctorUnavailability(doctorId, {
        slot_date: newDate,
        end_date: endDate,
        start_time: newStart || undefined,
        end_time: newEnd || undefined,
        reason: newReason || undefined,
      }, token);
      setNewDate(''); setNewEndDate(''); setNewStart(''); setNewEnd(''); setNewReason('');
      fetchUnavailability();
      setShowModal(false);
      setConflictWarning(null);
      const cc = record.conflict_count ?? 0;
      if (cc > 0) {
        setResolvePrompt({ id: record.id, count: cc });
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!doctorId) return;
    setDeleting(true);
    try {
      await api.deleteDoctorUnavailability(doctorId, id, token);
      setUnavail(prev => prev.filter(u => u.id !== id));
      if (expandedId === id) setExpandedId(null);
      setDeleteConfirm(null);
    } catch (e: any) {
      setError(e.message);
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
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
      const currentUnavailId = expandedId;
      if (currentUnavailId) {
        setConflicts(prev => ({
          ...prev,
          [currentUnavailId]: prev[currentUnavailId].filter(a => a.id !== appointmentId),
        }));
        setUnavail(prev => prev.map(u =>
          u.id === currentUnavailId ? { ...u, conflict_count: Math.max(0, (u.conflict_count ?? 0) - 1) } : u
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
        <Button onClick={() => { setShowModal(true); setModalStep(1); setIsDateRange(false); setIsFullDay(true); setNewStart(''); setNewEnd(''); setNewEndDate(''); }} icon={Add01Icon} className="shrink-0 mt-1.5">
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

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
        {(['all', 'pending', 'past'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${
              filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table styled like appointment list */}
      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : (() => {
          const filtered = unavail.filter(u => {
            if (filter === 'all') return true;
            if (filter === 'pending') return u.end_date >= today;
            return u.end_date < today;
          });
          return filtered.length === 0 ? (
          <EmptyState
            icon={Calendar02Icon}
            title="No unavailability records"
            description={filter !== 'all' ? `No ${filter} unavailability records found.` : "You have no blackout periods set."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                {filtered.map((u) => {
                  const hasConflicts = (u.conflict_count ?? 0) > 0;
                  const borderColor = hasConflicts ? '#f59e0b' : '#e2e8f0';

                  return (
                    <Fragment key={u.id}>
                      <tr
                        className="cursor-pointer transition-all duration-150 hover:bg-slate-50/80 group last:[&>td]:border-b-0"
                        onClick={() => handleToggleExpand(u.id)}
                      >
                        <td className="py-4 border-b border-slate-100 align-top px-5 whitespace-nowrap" style={{ borderLeft: `3px solid ${borderColor}` }}>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">
                              {u.end_date !== u.slot_date
                                ? `${formatDate(u.slot_date)} – ${formatDate(u.end_date)}`
                                : formatDate(u.slot_date)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 border-b border-slate-100 align-top px-5 whitespace-nowrap">
                          <span className="text-sm text-slate-600">
                            {u.start_time && u.end_time
                              ? `${formatTime(u.start_time)} – ${formatTime(u.end_time)}`
                              : <span className="text-slate-400">All day</span>}
                          </span>
                        </td>
                        <td className="py-4 border-b border-slate-100 align-top px-5">
                          <span className="text-sm text-slate-700">{u.reason || <span className="text-slate-400 italic">No reason</span>}</span>
                        </td>
                        <td className="py-4 border-b border-slate-100 align-top px-5">
                          {hasConflicts ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                              <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
                              {u.conflict_count ?? 0}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
                              None
                            </span>
                          )}
                        </td>
                        <td className="py-4 border-b border-slate-100 align-top">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(u.id); }}
                            className="p-1.5 rounded-md hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            <HugeiconsIcon icon={Delete01Icon} className="size-4 text-red-400" />
                          </button>
                        </td>
                      </tr>
                      {/* Expanded conflict rows */}
                      {expandedId === u.id && (
                        <tr>
                          <td colSpan={5} className="px-0 py-0">
                            <div className="bg-slate-50/80 border-b border-slate-100">
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
                                            {formatDate(a.slot_date)}
                                            {' · '}{formatTime(a.start_time)} — {formatTime(a.end_time)}
                                          </div>
                                        </div>
                                        <div className="shrink-0">
                                          {isRescheduling ? (
                                            <div className="flex items-center gap-1.5">
                                              <input type="date" value={rescheduleDate} min={today} onChange={e => setRescheduleDate(e.target.value)} className={`${smallInputClass} w-[130px]`} />
                                            <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} className={`${smallInputClass} w-[100px]`} />
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
                  );
                })}
              </tbody>
            </table>
          </div>
          );})()}
      </Card>

      {/* Add Modal — Two-step wizard */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-6" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                {modalStep === 2 && (
                  <button
                    onClick={() => { setModalStep(1); setNewEndDate(''); setNewStart(''); setNewEnd(''); setIsFullDay(true); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 rotate-180" />
                  </button>
                )}
                <h3 className="text-base font-bold text-slate-900">Add Unavailability</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </button>
            </div>

            {/* Step indicator (matching login page style) */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                {modalStep === 1 ? 'Type' : 'Details'}
              </span>
              <div className="flex items-center gap-1">
                {[1, 2].map((s, i) => (
                  <div key={s} className="flex items-center gap-1">
                    <div className={`rounded-full transition-all duration-300 ${
                      modalStep === s
                        ? 'size-2 bg-primary'
                        : i < modalStep - 1
                          ? 'size-2 bg-primary/30'
                          : 'size-1.5 bg-muted-foreground/15'
                    }`} />
                    {i < 1 && (
                      <div className={`w-3 h-px transition-colors duration-300 ${
                        modalStep > s ? 'bg-primary/20' : 'bg-muted-foreground/10'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {modalStep === 1 ? (
              /* Step 1: Choose date type */
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => { setIsDateRange(false); setModalStep(2); }}
                  className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-slate-200 bg-white p-8 transition-all hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="size-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                    <HugeiconsIcon icon={Calendar02Icon} className="size-6" />
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-slate-900">Single Day</div>
                    <div className="text-sm text-slate-500 mt-1">One date off</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsDateRange(true); setModalStep(2); }}
                  className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-slate-200 bg-white p-8 transition-all hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="size-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 gap-0.5 group-hover:bg-emerald-100 transition-colors">
                    <HugeiconsIcon icon={Calendar02Icon} className="size-5" />
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 text-emerald-400 -ml-0.5" />
                    <HugeiconsIcon icon={Calendar02Icon} className="size-5" />
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-slate-900">Date Range</div>
                    <div className="text-sm text-slate-500 mt-1">Multiple consecutive</div>
                  </div>
                </button>
              </div>
            ) : (
              /* Step 2: Details form */
              <div className="space-y-6">
                {/* Date section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</span>
                  </div>
                  <div className={isDateRange ? 'grid grid-cols-2 gap-3' : ''}>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1.5">{isDateRange ? 'Start date *' : 'Date *'}</label>
                      <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={today} inputSize="xl" />
                    </div>
                    {isDateRange && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">End date *</label>
                        <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} min={newDate || today} inputSize="xl" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-700 font-medium">Time</span>
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <button
                          type="button"
                          onClick={() => { setIsFullDay(true); setNewStart(''); setNewEnd(''); }}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${isFullDay ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          All Day
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsFullDay(false)}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${!isFullDay ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                          Specific Time
                        </button>
                      </div>
                    </div>
                    {!isFullDay && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">Start time *</label>
                          <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} inputSize="xl" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1">End time *</label>
                          <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} inputSize="xl" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reason section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</span>
                  </div>
                  <Input type="text" value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g. Annual leave, conference, sick day" inputSize="xl" />
                </div>
              </div>
            )}

            {/* Footer buttons */}
            {modalStep === 2 && (
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button onClick={handleCreate} loading={saving} disabled={!newDate}>
                  Save
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conflict Warning Modal (separate overlay) */}
      {conflictWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setConflictWarning(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="mx-auto size-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-6 text-amber-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Conflicts Detected</h3>
            <p className="text-sm text-slate-500 mb-6">
              {conflictWarning.count} appointment{conflictWarning.count !== 1 ? 's' : ''} conflict{conflictWarning.count !== 1 ? '' : 's'} with this unavailability. Do you want to proceed?
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={() => setConflictWarning(null)}>Cancel</Button>
              <Button onClick={handleCreateConfirmed} loading={saving}>Proceed Anyway</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="mx-auto size-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-6 text-red-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Delete Unavailability?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This action cannot be undone. Any conflicting appointments will remain scheduled.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
              <Button onClick={() => handleDelete(deleteConfirm)} loading={deleting}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
