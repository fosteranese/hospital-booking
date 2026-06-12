import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useCachedData } from '@/hooks/useCachedData';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/EmptyState';
import { RescheduleModal } from '@/components/RescheduleModal';
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
  Search01Icon,
} from '@hugeicons/core-free-icons';
import { formatTime, formatDate, inputClass } from '@/lib/helpers';




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
  const { token, profile } = useAuth();
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('pending');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const doctorIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (profile?.doctor_id) {
      doctorIdRef.current = profile.doctor_id;
      setDoctorId(profile.doctor_id);
      setProfileReady(true);
    }
    setProfileLoading(false);
  }, [profile?.doctor_id]);

  const { data: cachedUnavail, loading, error: fetchError, backgroundRefresh } = useCachedData(
    'unavailability:doctor',
    useCallback(async () => {
      return await api.getDoctorUnavailability(doctorIdRef.current!, token);
    }, [token]),
    { enabled: profileReady }
  );

  const [unavail, setUnavail] = useState<UnavailRecord[]>(cachedUnavail ?? []);

  useEffect(() => {
    if (cachedUnavail) setUnavail(cachedUnavail);
  }, [cachedUnavail]);

  const displayError = error || fetchError;

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
      backgroundRefresh();
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

  const handleResolved = () => {
    if (expandedId) {
      fetchConflicts(expandedId);
      setUnavail(prev => prev.map(u =>
        u.id === expandedId ? { ...u, conflict_count: Math.max(0, (u.conflict_count ?? 0) - 1) } : u
      ));
      setResolvePrompt(null);
    }
    backgroundRefresh();
  };

  if (!doctorId && !profileLoading) {
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
      <PageHeader
        title="My Unavailability"
        description="Manage your time off and blackout periods"
        icon={Clock01Icon}
        actions={
          <Button onClick={() => { setShowModal(true); setModalStep(1); setIsDateRange(false); setIsFullDay(true); setNewStart(''); setNewEnd(''); setNewEndDate(''); }} icon={Add01Icon}>
            Add Unavailability
          </Button>
        }
      />

      {displayError && (
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-4 py-3 rounded-lg ring-1 ring-red-200/50 dark:ring-red-900/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {displayError}
        </div>
      )}

      {/* Resolve prompt banner */}
      {resolvePrompt && (
        <div className="flex items-center justify-between gap-4 text-sm text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-5 py-3.5 rounded-lg ring-1 ring-red-200/60 dark:ring-red-900/60">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            <span>There {resolvePrompt.count === 1 ? 'is' : 'are'} <strong>{resolvePrompt.count}</strong> appointment{resolvePrompt.count !== 1 ? 's' : ''} that conflict with this unavailability.</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => { setExpandedId(resolvePrompt.id); if (!conflicts[resolvePrompt.id]) fetchConflicts(resolvePrompt.id); setResolvePrompt(null); }}>
              Resolve Conflicts
            </Button>
            <button onClick={() => setResolvePrompt(null)} className="p-1.5 rounded-lg text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search bar + filter pills */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center h-12 w-full max-w-full sm:max-w-[340px] rounded-lg border border-border bg-card focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all shadow-sm">
          <div className="shrink-0 text-muted-foreground ml-3">
            <HugeiconsIcon icon={Search01Icon} className="size-4" />
          </div>
          <input
            type="text"
            placeholder="Search by date or reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 h-full pl-3 pr-3 text-sm bg-transparent focus:outline-none min-w-0 placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="shrink-0 mr-1.5 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap shrink-0">
          {[
            { key: 'pending', label: 'Pending', color: 'bg-amber-400' },
            { key: 'conflicts', label: 'Conflicts', color: 'bg-red-500' },
            { key: 'past', label: 'Past', color: 'bg-muted-foreground' },
            { key: 'all', label: 'All', color: '' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                filter === f.key
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {f.color && <div className={`size-1.5 rounded-full ${f.color}`} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table styled like appointment list */}
      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : (() => {
          const filtered = unavail.filter(u => {
            if (filter === 'all') return true;
            if (filter === 'pending') return u.end_date >= today;
            if (filter === 'past') return u.end_date < today;
            if (filter === 'conflicts') return (u.conflict_count ?? 0) > 0;
            return true;
          }).filter(u => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
              u.slot_date.toLowerCase().includes(q) ||
              (u.end_date !== u.slot_date && u.end_date.toLowerCase().includes(q)) ||
              (u.reason && u.reason.toLowerCase().includes(q))
            );
          });
          return filtered.length === 0 ? (
          <EmptyState
            icon={Calendar02Icon}
            title="No unavailability records"
            description={filter !== 'all' ? `No ${filter} unavailability records found.` : "You have no blackout periods set."}
          />
        ) : (
          <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                {filtered.map((u) => {
                  const hasConflicts = (u.conflict_count ?? 0) > 0;
                  const isPast = u.end_date < today;
                  const borderColor = hasConflicts ? '#ef4444' : isPast ? '#cbd5e1' : '#f59e0b';

                  return (
                    <Fragment key={u.id}>
                      <tr
                        className="cursor-pointer transition-all duration-150 hover:bg-muted/80 group last:[&>td]:border-b-0"
                        onClick={() => handleToggleExpand(u.id)}
                      >
                        <td className="py-4 border-b border-border align-top px-5 whitespace-nowrap" style={{ borderLeft: `3px solid ${borderColor}` }}>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-foreground">
                              {u.end_date !== u.slot_date
                                ? `${formatDate(u.slot_date)} – ${formatDate(u.end_date)}`
                                : formatDate(u.slot_date)}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 border-b border-border align-top px-5 whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">
                            {u.start_time && u.end_time
                              ? `${formatTime(u.start_time)} – ${formatTime(u.end_time)}`
                              : <span className="text-muted-foreground">All day</span>}
                          </span>
                        </td>
                        <td className="py-4 border-b border-border align-top px-5">
                          <span className="text-sm text-foreground">{u.reason || <span className="text-muted-foreground italic">No reason</span>}</span>
                        </td>
                        <td className="py-4 border-b border-border align-top px-5">
                          {hasConflicts ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-full">
                              <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
                              {u.conflict_count ?? 0}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3" />
                              None
                            </span>
                          )}
                        </td>
                        <td className="py-4 border-b border-border align-top">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(u.id); }}
                            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete"
                          >
                            <HugeiconsIcon icon={Delete01Icon} className="size-4 text-red-400 dark:text-red-500" />
                          </button>
                        </td>
                      </tr>
                      {/* Expanded conflict rows */}
                      {expandedId === u.id && (
                        <tr>
                          <td colSpan={5} className="px-0 py-0">
                            <div className="bg-muted/80 border-b border-border">
                              {conflictsLoading === u.id ? (
                                <div className="px-8 py-4 space-y-2">
                                  {[1, 2].map(i => <div key={i} className="h-10 bg-muted rounded-md animate-pulse" />)}
                                </div>
                              ) : conflicts[u.id]?.length > 0 ? (
                                <div>
                                  <div className="px-8 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Conflicting Appointments ({conflicts[u.id].length})
                                  </div>
                                  {conflicts[u.id].map(a => {
                                    return (
                                      <div key={a.id} className="flex items-center gap-3 px-8 py-2.5 border-b border-border last:border-b-0">
                                        <div className="size-7 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-[10px] font-semibold text-red-600 dark:text-red-400 shrink-0">
                                          {(a.patient_name || 'P').split(' ').filter(Boolean).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-medium text-foreground truncate">{a.patient_name}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {formatDate(a.slot_date)}
                                            {' · '}{formatTime(a.start_time)} — {formatTime(a.end_time)}
                                          </div>
                                        </div>
                                        <div className="shrink-0">
                                          <button
                                            onClick={() => setRescheduleTarget(a)}
                                            className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 px-2.5 py-1.5 rounded-lg transition-colors"
                                          >
                                            <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 mr-1" />
                                            Reschedule
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="px-8 py-4 text-xs text-muted-foreground">No conflicting appointments found.</div>
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
          <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-card rounded-2xl shadow-2xl ring-1 ring-border w-full max-w-xl mx-4 p-6" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                {modalStep === 2 && (
                  <button
                    onClick={() => { setModalStep(1); setNewEndDate(''); setNewStart(''); setNewEnd(''); setIsFullDay(true); }}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 rotate-180" />
                  </button>
                )}
                <h3 className="text-base font-bold text-foreground">Add Unavailability</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => { setIsDateRange(false); setModalStep(2); }}
                  className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-border bg-card p-8 transition-all hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="size-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                    <HugeiconsIcon icon={Calendar02Icon} className="size-6" />
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-foreground">Single Day</div>
                    <div className="text-sm text-muted-foreground mt-1">One date off</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => { setIsDateRange(true); setModalStep(2); }}
                  className="group relative flex flex-col items-center gap-4 rounded-xl border-2 border-border bg-card p-8 transition-all hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="size-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 gap-0.5 group-hover:bg-emerald-100 transition-colors">
                    <HugeiconsIcon icon={Calendar02Icon} className="size-5" />
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 text-emerald-400 -ml-0.5" />
                    <HugeiconsIcon icon={Calendar02Icon} className="size-5" />
                  </div>
                  <div className="text-center">
                    <div className="text-base font-semibold text-foreground">Date Range</div>
                    <div className="text-sm text-muted-foreground mt-1">Multiple consecutive</div>
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
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</span>
                  </div>
                  <div className={isDateRange ? 'grid grid-cols-2 gap-3' : ''}>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{isDateRange ? 'Start date *' : 'Date *'}</label>
                      <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={today} inputSize="xl" />
                    </div>
                    {isDateRange && (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">End date *</label>
                        <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} min={newDate || today} inputSize="xl" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Duration section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</span>
                  </div>
                  <div className="bg-muted rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground font-medium">Time</span>
                      <div className="flex rounded-lg border border-border overflow-hidden bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                        <button
                          type="button"
                          onClick={() => { setIsFullDay(true); setNewStart(''); setNewEnd(''); }}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${isFullDay ? 'bg-emerald-600 dark:bg-emerald-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                          All Day
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsFullDay(false)}
                          className={`px-4 py-2 text-sm font-medium transition-colors ${!isFullDay ? 'bg-emerald-600 dark:bg-emerald-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                          Specific Time
                        </button>
                      </div>
                    </div>
                    {!isFullDay && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">Start time *</label>
                          <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} inputSize="xl" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">End time *</label>
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
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</span>
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
          <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-card rounded-2xl shadow-2xl ring-1 ring-border w-full max-w-sm mx-4 p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="mx-auto size-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">Conflicts Detected</h3>
            <p className="text-sm text-muted-foreground mb-6">
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
          <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
          <div className="relative bg-card rounded-2xl shadow-2xl ring-1 ring-border w-full max-w-sm mx-4 p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="mx-auto size-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
              <HugeiconsIcon icon={AlertCircleIcon} className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">Delete Unavailability?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              This action cannot be undone. Any conflicting appointments will remain scheduled.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Cancel</Button>
              <Button onClick={() => handleDelete(deleteConfirm)} loading={deleting}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      <RescheduleModal
        open={!!rescheduleTarget}
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onResolved={handleResolved}
      />
    </div>
  );
}
