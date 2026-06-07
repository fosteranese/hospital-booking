import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { AppointmentSlidePanel } from '@/components/AppointmentSlidePanel';
import { ConfirmAttendanceModal } from '@/components/ConfirmAttendanceModal';
import { RescheduleModal } from '@/components/RescheduleModal';
import { ScheduleModal } from '@/components/ScheduleModal';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, AlertCircleIcon, CheckmarkCircle01Icon, Cancel01Icon, Search01Icon, ChevronDownIcon } from '@hugeicons/core-free-icons';

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

function PatientAvatar({ name }: { name: string }) {
  const initials = (name || 'P')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('');
  return (
    <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-[11px] font-semibold text-slate-600">
      {initials}
    </div>
  );
}

function StatusDot({ status, attended }: { status: string; attended: boolean | null }) {
  if (attended === true) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-600 font-medium">Attended</span>
      </div>
    );
  }
  if (attended === false) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-purple-500 shrink-0" />
        <span className="text-xs text-purple-600 font-medium">Missed</span>
      </div>
    );
  }
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-slate-300 shrink-0" />
        <span className="text-xs text-slate-400 font-medium">Cancelled</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <div className="size-2 rounded-full bg-amber-400 shrink-0" />
      <span className="text-xs text-amber-600 font-medium">Confirmed</span>
    </div>
  );
}

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'name', label: 'Name' },
  { value: 'notes', label: 'Notes' },
];

const placeholderMap: Record<string, string> = {
  all: 'Search patients or notes...',
  name: 'Search by patient name...',
  notes: 'Search by notes...',
};

export function DoctorPastAppointmentsPage() {
  const { token } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [pendingAttendance, setPendingAttendance] = useState<{ id: string; attended: boolean } | null>(null);
  const { doctorCanCreateAppointments, doctorCanRefer,
    attendedFollowUpDays, attendedReferralDays, missedRescheduleDays, missedReferralDays } = useAuth();

  const canSchedule = doctorCanCreateAppointments || doctorCanRefer;
  const scheduleLabel = !doctorCanCreateAppointments && doctorCanRefer ? 'Refer Patient'
    : doctorCanCreateAppointments && !doctorCanRefer ? 'Book a Follow Up'
    : 'New Appointment';
  const forcedScheduleType = !doctorCanCreateAppointments && doctorCanRefer ? 'referral'
    : doctorCanCreateAppointments && !doctorCanRefer ? 'follow-up'
    : undefined;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAppointments({ to: yesterday }, token);
      setAppointments(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [token, yesterday]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const requestAttendance = useCallback(async (id: string, attended: boolean) => {
    try {
      await api.markAttendance(id, { attended }, token);
      fetchAppointments();
    } catch (e: any) {
      setError(e.message);
    }
  }, [token, fetchAppointments]);

  const confirmAttendance = useCallback(async (minutesLate?: number) => {
    if (!pendingAttendance) return;
    try {
      await api.markAttendance(pendingAttendance.id, { attended: pendingAttendance.attended, minutes_late: minutesLate }, token);
      fetchAppointments();
      setPendingAttendance(null);
    } catch (e: any) {
      setError(e.message);
      setPendingAttendance(null);
    }
  }, [pendingAttendance, token, fetchAppointments]);

  const filtered = useMemo(() => {
    return appointments.filter(a => {
      if (searchFilter === 'all') return true;
      if (searchFilter === 'name') return a.patient_name?.toLowerCase().includes(searchQuery.toLowerCase());
      if (searchFilter === 'notes') return a.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      return (
        (a.patient_name && a.patient_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (a.notes && a.notes.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
  }, [appointments, searchQuery, searchFilter]);

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, AppointmentHistoryItem[]> = {};
    for (const a of filtered) {
      const monthKey = a.slot_date.slice(0, 7); // "2026-06"
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(a);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, rows]) => ({ month, rows: rows.sort((a, b) => b.slot_date.localeCompare(a.slot_date) || b.start_time.localeCompare(a.start_time)) }));
  }, [filtered]);

  const currentFilter = filterOptions.find(o => o.value === searchFilter);
  const selectedForModal = pendingAttendance ? appointments.find(a => a.id === pendingAttendance.id) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Past Appointments"
        description="View appointment history"
        icon={Calendar01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="flex items-center h-12 w-full max-w-[340px] rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all shadow-sm">
          <div className="shrink-0 text-slate-400 ml-3">
            <HugeiconsIcon icon={Search01Icon} className="size-4" />
          </div>
          <input
            type="text"
            placeholder={placeholderMap[searchFilter]}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 h-full pl-3 pr-3 text-sm bg-transparent focus:outline-none min-w-0 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="shrink-0 mr-1.5 p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          )}
          <div className="relative p-1.5" ref={filterRef}>
            <button onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 h-full rounded-md py-1.5 px-2.5 text-xs font-medium text-slate-600 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 transition-all whitespace-nowrap"
            >
              {currentFilter?.label}
              <HugeiconsIcon icon={ChevronDownIcon} className={`size-3 transition-transform duration-150 ${filterOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1.5 min-w-[8rem] bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1.5 overflow-hidden">
                {filterOptions.map(opt => (
                  <button key={opt.value} onMouseDown={e => { e.preventDefault(); setSearchFilter(opt.value); setFilterOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors ${opt.value === searchFilter ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Calendar01Icon} title="No past appointments" description="No past appointments match the selected filter." />
        ) : (
          <div className="space-y-4">
            {groupedByMonth.map(({ month, rows }) => {
              const monthDate = new Date(month + '-01T00:00:00');
              const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              return (
                <div key={month} className="rounded-lg">
                  <div className="sticky top-0 z-10 bg-background px-5 py-3">
                    <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">{monthLabel}</span>
                    <span className="ml-2.5 text-xs text-slate-400 font-medium">{rows.length} appointment{rows.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="bg-white rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)]">
                    <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                      <tbody>
                        {rows.map(a => {
                          const isAttended = a.attended === true;
                          const isMissed = a.attended === false;
                          const isCancelled = a.status === 'cancelled';
                          const isPending = !isAttended && !isMissed && !isCancelled;
                          const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : isCancelled ? '#cbd5e1' : '#f59e0b';
                          const canAttend = isPending;
                          return (
                            <tr key={a.id} className="transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0" style={{ transformOrigin: 'center' }}
                              onClick={() => setSelectedAppointment(a)}
                            >
                              <td className="py-4 w-[110px] border-b border-slate-100 align-top pl-4" style={{ borderLeft: `3px solid ${borderColor}` }}>
                                <div className="flex flex-col items-start">
                                  <span className="text-base font-semibold text-slate-900">{formatTime(a.start_time)}</span>
                                  <span className="text-xs text-slate-400">{formatTime(a.end_time)}</span>
                                </div>
                              </td>
                              <td className="w-10 p-2 border-b border-slate-100 text-center">
                                <PatientAvatar name={a.patient_name} />
                              </td>
                              <td className="min-w-0 py-4 border-b border-slate-100 align-top">
                                <div className="text-base font-medium text-slate-900 truncate">{a.patient_name || 'Patient'}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{formatDate(a.slot_date)} · Dr. {a.doctor_name}</div>
                              </td>
                              <td className="w-[100px] py-4 border-b border-slate-100 align-top">
                                <StatusDot status={a.status} attended={a.attended} />
                              </td>
                              <td className="pr-3 w-0 py-4 border-b border-slate-100 align-top">
                                {canAttend ? (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button onClick={e => { e.stopPropagation(); requestAttendance(a.id, true); }}
                                      className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors" title="Mark attended"
                                    ><HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" /></button>
                                    <button onClick={e => { e.stopPropagation(); requestAttendance(a.id, false); }}
                                      className="p-1.5 rounded-md text-red-400 hover:bg-red-50 transition-colors" title="Mark missed"
                                    ><HugeiconsIcon icon={Cancel01Icon} className="size-4" /></button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <button onClick={e => { e.stopPropagation(); setSelectedAppointment(a); }}
                                      className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                                    ><HugeiconsIcon icon={Search01Icon} className="size-4" /></button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {selectedAppointment && (
        <AppointmentSlidePanel
          appointment={selectedAppointment}
          onClose={() => { setSelectedAppointment(null); fetchAppointments(); }}
          onRequestAttendance={requestAttendance}
          onReschedule={setRescheduleTarget}
          onScheduleNew={canSchedule ? setScheduleTarget : undefined}
          canSchedule={canSchedule}
          scheduleLabel={scheduleLabel}
          forcedScheduleType={forcedScheduleType}
          attendedFollowUpDays={attendedFollowUpDays}
          attendedReferralDays={attendedReferralDays}
          missedRescheduleDays={missedRescheduleDays}
          missedReferralDays={missedReferralDays}
        />
      )}

      {selectedForModal && (
        <ConfirmAttendanceModal
          open={!!pendingAttendance}
          patientName={selectedForModal.patient_name}
          slotDate={selectedForModal.slot_date}
          startTime={selectedForModal.start_time}
          endTime={selectedForModal.end_time}
          attended={pendingAttendance!.attended}
          onConfirm={confirmAttendance}
          onCancel={() => setPendingAttendance(null)}
        />
      )}

      <RescheduleModal
        open={!!rescheduleTarget}
        appointment={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onResolved={fetchAppointments}
      />

      <ScheduleModal
        open={!!scheduleTarget}
        patientId={scheduleTarget?.patient_id || ''}
        patientName={scheduleTarget?.patient_name || ''}
        currentDoctorId={scheduleTarget?.doctor_id || ''}
        currentDoctorName={scheduleTarget?.doctor_name || ''}
        onClose={() => setScheduleTarget(null)}
        onScheduled={fetchAppointments}
        forcedType={forcedScheduleType}
      />
    </div>
  );
}
