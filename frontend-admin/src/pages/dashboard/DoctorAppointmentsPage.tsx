import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useContentContainer } from '@/pages/dashboard/DashboardLayout';
import { AppointmentSlidePanel } from '@/components/AppointmentSlidePanel';
import { ConfirmAttendanceModal } from '@/components/ConfirmAttendanceModal';
import { RescheduleModal } from '@/components/RescheduleModal';
import { ScheduleModal } from '@/components/ScheduleModal';
import { UnavailabilityConflictBanner } from '@/components/UnavailabilityConflictBanner';
import { RefreshButton } from '@/components/RefreshButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import { format } from 'date-fns';
import { useCachedData } from '@/hooks/useCachedData';


import { MiniCalendar } from '@/components/MiniCalendar';
import { CalendarSlidePanel } from '@/components/CalendarSlidePanel';
import {
  Calendar01Icon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  Search01Icon,
  ChevronDownIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';

import { formatTime, formatDate, PatientAvatar, toDateOnly, isBeforeToday } from '@/lib/helpers';
import { StatusDot } from '@/components/StatusDot';
import { useToast } from '@/contexts/toast-context';




const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'time', label: 'Time' },
];

const placeholderMap: Record<string, string> = {
  all: 'Search patients...',
  name: 'Search by patient name...',
  email: 'Search by email...',
  phone: 'Search by phone...',
  time: 'Search by time...',
};

export function DoctorAppointmentsPage() {
  const { token, doctorCanCreateAppointments, doctorCanRefer,
    attendedFollowUpDays, attendedReferralDays, missedRescheduleDays, missedReferralDays } = useAuth();
  const canSchedule = doctorCanCreateAppointments || doctorCanRefer;
  const scheduleLabel = !doctorCanCreateAppointments && doctorCanRefer ? 'Refer Patient'
    : doctorCanCreateAppointments && !doctorCanRefer ? 'Book a Follow Up'
    : 'New Appointment';
  const forcedScheduleType = !doctorCanCreateAppointments && doctorCanRefer ? 'referral'
    : doctorCanCreateAppointments && !doctorCanRefer ? 'follow-up'
    : undefined;
  const { addToast } = useToast();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(() => window.innerWidth >= 1024);

  const [pendingAttendance, setPendingAttendance] = useState<{
    id: string;
    attended: boolean;
  } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [conflictFilter, setConflictFilter] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const { data: rawAppointments, loading, error, refresh: refreshAppointments, backgroundRefresh } = useCachedData(
    'appointments:upcoming',
    useCallback(async () => {
      const data = await api.listAppointments({}, token);
      const upcoming = data.filter(a => a.slot_date >= today);
      upcoming.sort((a, b) => {
        if (a.slot_date !== b.slot_date) return a.slot_date.localeCompare(b.slot_date);
        return a.start_time.localeCompare(b.start_time);
      });
      return upcoming;
    }, [token, today]),
    { enabled: !!token }
  );
  const appointments = rawAppointments ?? [];

  const refreshAll = useCallback(() => {
    backgroundRefresh();
  }, [backgroundRefresh]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const requestAttendance = useCallback((id: string, attended: boolean) => {
    setPendingAttendance({ id, attended });
  }, []);

  const confirmAttendance = useCallback(async (arrivalTime?: string) => {
    if (!pendingAttendance) return;
    try {
      await api.markAttendance(pendingAttendance.id, { attended: pendingAttendance.attended, arrival_time: arrivalTime }, token);
      addToast(pendingAttendance.attended ? 'Attendance marked' : 'Marked as missed', 'success');
      setPendingAttendance(null);
      setSelectedAppointment(null);
      refreshAll();
    } catch (e: any) {
      console.error(e.message);
      setPendingAttendance(null);
    }
  }, [pendingAttendance, token, refreshAll, addToast]);

  const selectedForModal = pendingAttendance
    ? (appointments as AppointmentHistoryItem[]).find(a => a.id === pendingAttendance.id)
    : null;

  const { setContainerClass } = useContentContainer();
  const panelOpen = calendarOpen || !!selectedAppointment;

  useEffect(() => {
    setContainerClass(panelOpen
      ? 'max-w-[2000px] lg:max-w-[calc(80rem+480px)] mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200'
      : 'max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
    return () => setContainerClass('max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
  }, [panelOpen, setContainerClass]);

  const selectAppointment = useCallback((a: AppointmentHistoryItem) => {
    setSelectedAppointment(a);
  }, []);


  const conflictCount = useMemo(() => appointments.filter(a => a.attended === null && a.has_conflict).length, [appointments]);

  const filtered = appointments.filter(a => a.attended === null).filter(a => {
    if (!filterDate) return true;
    if (filterDate.includes('_')) {
      const [from, to] = filterDate.split('_');
      return a.slot_date >= from && a.slot_date <= to;
    }
    return a.slot_date === filterDate;
  }).filter(a => !conflictFilter || a.has_conflict).filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    if (searchFilter === 'name') return a.patient_name && a.patient_name.toLowerCase().includes(q);
    if (searchFilter === 'email') return a.patient_email && a.patient_email.toLowerCase().includes(q);
    if (searchFilter === 'phone') return a.patient_phone && a.patient_phone.toLowerCase().includes(q);
    if (searchFilter === 'time') return (a.start_time && a.start_time.toLowerCase().includes(q)) || (a.end_time && a.end_time.toLowerCase().includes(q));
    return (
      (a.patient_name && a.patient_name.toLowerCase().includes(q)) ||
      (a.patient_email && a.patient_email.toLowerCase().includes(q)) ||
      (a.patient_phone && a.patient_phone.toLowerCase().includes(q)) ||
      (a.start_time && a.start_time.toLowerCase().includes(q)) ||
      (a.end_time && a.end_time.toLowerCase().includes(q))
    );
  });

  const currentFilter = filterOptions.find(o => o.value === searchFilter);
  const isToday = (date: string) => date === today;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const isTomorrow = (date: string) => date === tomorrow;
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const groupedByDate = filtered.reduce((acc, a) => {
    if (!acc[a.slot_date]) acc[a.slot_date] = [];
    acc[a.slot_date].push(a);
    return acc;
  }, {} as Record<string, AppointmentHistoryItem[]>);

  const sortedDates = Object.keys(groupedByDate).sort();

  const eventDates = useMemo(() => {
    return new Set(appointments.filter(a => a.attended === null).map(a => a.slot_date));
  }, [appointments]);

  return (
    <div className={`space-y-6 transition-[margin-right] duration-200 ${
      panelOpen ? 'lg:mr-[480px]' : ''
    }`}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Upcoming Appointments"
          description={conflictFilter
            ? `${filtered.length} appointment${filtered.length !== 1 ? 's' : ''} with conflicts`
            : `${filtered.length} pending appointment${filtered.length !== 1 ? 's' : ''}`}
          icon={Calendar01Icon}
        />

        <div className="flex items-center gap-2 shrink-0 self-start pt-1">
          <RefreshButton onClick={refreshAll} />
          <button
            onClick={() => { setSelectedAppointment(null); setCalendarOpen(v => !v); }}
            className={`w-12 h-12 flex items-center justify-center rounded-lg border bg-card shadow-sm transition-all ${
              filterDate || calendarOpen
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-100/50'
                : 'border-slate-200 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <HugeiconsIcon icon={Calendar01Icon} className="size-5" />
          </button>
        </div>

        {/* Error */}
      {error && <ErrorAlert message={error} variant="compact" />}
      </div>

      <UnavailabilityConflictBanner />

      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center h-12 w-full max-w-full sm:max-w-[340px] rounded-lg border border-border bg-card focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all shadow-sm">
          <div className="shrink-0 text-muted-foreground ml-3">
            <HugeiconsIcon icon={Search01Icon} className="size-4" />
          </div>
          <input
            type="text"
            placeholder={placeholderMap[searchFilter]}
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
          <div className="relative p-1.5" ref={filterRef}>
            <button
              onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 h-full rounded-md py-1.5 px-2.5 text-xs font-medium text-muted-foreground bg-muted hover:bg-slate-300 active:bg-muted transition-all whitespace-nowrap"
            >
              {currentFilter?.label}
              <HugeiconsIcon icon={ChevronDownIcon} className={`size-3 transition-transform duration-150 ${filterOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1.5 min-w-[8rem] bg-card border border-border rounded-xl shadow-xl z-20 py-1.5 overflow-hidden">
                {filterOptions.map(opt => (
                  <button
                    key={opt.value}
                    onMouseDown={e => { e.preventDefault(); setSearchFilter(opt.value); setFilterOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                      opt.value === searchFilter
                        ? 'bg-emerald-50 text-emerald-600 font-semibold'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap shrink-0 mt-2 sm:mt-0">
          {[
            { key: 'all', label: 'All', count: filtered.length, color: '' },
            { key: 'conflicts', label: 'Conflicts', count: conflictCount, color: 'bg-red-500' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setConflictFilter(f.key === 'conflicts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                (f.key === 'conflicts' && conflictFilter) || (f.key === 'all' && !conflictFilter)
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {f.color && <div className={`size-1.5 rounded-full ${f.color}`} />}
              {f.label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                (f.key === 'conflicts' && conflictFilter) || (f.key === 'all' && !conflictFilter)
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-muted-foreground'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Calendar01Icon}
            title="No appointments"
            description="No appointments match the selected filter."
          />
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => {
              const rows = groupedByDate[date];
              return (
                <div key={date} className="rounded-lg">
                  <div className="sticky top-0 z-10 bg-background px-5 py-3">
                    <span className="text-sm font-bold text-foreground uppercase tracking-wider">
                      {isToday(date) ? `Today – ${todayLabel}` : isTomorrow(date) ? `Tomorrow – ${todayLabel}` : formatDate(date)}
                    </span>
                    <span className="ml-2.5 text-xs text-muted-foreground font-medium">
                      {rows.length} appointment{rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="bg-card rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)]">
                  <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <tbody>
                      {rows.map(a => {
                        const isAttended = a.attended === true;
                        const isMissed = a.attended === false;
                        const isPending = !isAttended && !isMissed;
                        const isPast = isPending && isBeforeToday(a.slot_date);
                        const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : a.has_conflict ? '#ef4444' : isPast ? '#9333ea' : '#f59e0b';
                        const canAttend = isToday(a.slot_date) && isPending && (() => {
                          const [h, m] = a.end_time.split(':').map(Number);
                          const slotEnd = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), h, m);
                          return new Date() >= slotEnd;
                        })();

                        return (
                          <tr
                            key={a.id}
                            className={`rounded-lg cursor-pointer transition-all duration-150 hover:bg-muted/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0 ${a.has_conflict ? 'bg-red-50/30 dark:bg-red-950/30' : ''}`}
                            onClick={() => selectAppointment(a)}
                            style={{ transformOrigin: 'center' }}
                          >
                            <td className="py-4 w-[110px] border-b border-border align-top pl-4" style={{ borderLeft: `3px solid ${borderColor}` }}>
                              <div className="flex flex-col items-start">
                                <span className="text-base font-semibold text-foreground">{formatTime(a.start_time)}</span>
                                <span className="text-xs text-muted-foreground">{formatTime(a.end_time)}</span>
                              </div>
                            </td>
                            <td className="w-10 p-2 border-b border-border text-center">
                              <PatientAvatar name={a.patient_name} />
                            </td>
                            <td className="min-w-0 py-4 border-b border-border align-top">
                              <div className="flex items-center gap-1.5">
                                <div className="text-base font-medium text-foreground truncate">{a.patient_name || 'Patient'}</div>
                                {a.has_conflict && <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 text-red-500 dark:text-red-400 shrink-0" />}
                                {a.referring_doctor_id && (
                                  <span title={a.referring_doctor_name ? `Referred by Dr. ${a.referring_doctor_name}` : 'Referred by another doctor'}>
                                    <HugeiconsIcon icon={UserGroupIcon} className="size-3.5 text-violet-500 shrink-0" />
                                  </span>
                                )}
                                {a.referring_doctor_name && <span className="text-xs text-violet-400 ml-0.5">(ref. Dr. {a.referring_doctor_name})</span>}
                              </div>
                              {a.notes && <div className="text-xs text-muted-foreground truncate mt-0.5">{a.notes}</div>}
                            </td>
                            <td className="w-[100px] py-4 border-b border-border align-top">
                              <StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} start_time={a.start_time} arrival_time={a.arrival_time} slot_date={a.slot_date} has_conflict={a.has_conflict} />
                            </td>
                            <td className="pr-3 w-0 py-4 border-b border-border align-top">
                              {canAttend ? (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    onClick={e => { e.stopPropagation(); requestAttendance(a.id, true); }}
                                    className="p-1.5 rounded-md text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                                    title="Mark attended"
                                  >
                                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); requestAttendance(a.id, false); }}
                                    className="p-1.5 rounded-md text-red-400 hover:bg-red-50 transition-colors"
                                    title="Mark missed"
                                  >
                                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setSelectedAppointment(a); }}
                                    className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                  >
                                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    onClick={e => { e.stopPropagation(); setSelectedAppointment(a); }}
                                    className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                  >
                                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                                  </button>
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
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedAppointment && (
        <AppointmentSlidePanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
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

      <CalendarSlidePanel
        open={calendarOpen}
        filterDate={filterDate}
        onFilterDate={setFilterDate}
        eventDates={eventDates}
        onClose={() => setCalendarOpen(false)}
      />      {selectedForModal && (
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
        onResolved={refreshAll}
      />
      <ScheduleModal
        open={!!scheduleTarget}
        patientId={scheduleTarget?.patient_id || ''}
        patientName={scheduleTarget?.patient_name || ''}
        currentDoctorId={scheduleTarget?.doctor_id || ''}
        currentDoctorName={scheduleTarget?.doctor_name || ''}
        onClose={() => setScheduleTarget(null)}
        onScheduled={refreshAll}
        forcedType={forcedScheduleType}
      />
    </div>
  );
}
