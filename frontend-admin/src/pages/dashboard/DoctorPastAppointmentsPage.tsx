import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useContentContainer } from '@/pages/dashboard/DashboardLayout';
import { AppointmentSlidePanel } from '@/components/AppointmentSlidePanel';
import { ConfirmAttendanceModal } from '@/components/ConfirmAttendanceModal';
import { RescheduleModal } from '@/components/RescheduleModal';
import { ScheduleModal } from '@/components/ScheduleModal';
import { RefreshButton } from '@/components/RefreshButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { SearchFilterBar } from '@/components/SearchFilterBar';
import { HugeiconsIcon } from '@hugeicons/react';
import { format } from 'date-fns';
import { MiniCalendar } from '@/components/MiniCalendar';
import { Calendar01Icon, AlertCircleIcon, CheckmarkCircle01Icon, Cancel01Icon, ArrowRight01Icon, TimeScheduleIcon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { DateRangeSlidePanel } from '@/components/DateRangeSlidePanel';
import { useCachedData } from '@/hooks/useCachedData';
import { useSlidePanel } from '@/hooks/useSlidePanel';





import { formatTime, formatDate, PatientAvatar, daysAgo, isBeforeToday } from '@/lib/helpers';
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


const dateRangeOptions = [
  { key: 'yesterday', label: 'Yesterday', from: () => daysAgo(1), to: () => daysAgo(1) },
  { key: 'week', label: 'Last 7 Days', from: () => daysAgo(7), to: () => daysAgo(1) },
  { key: 'month', label: 'Last 30 Days', from: () => daysAgo(30), to: () => daysAgo(1) },
  { key: 'year', label: 'Last 365 Days', from: () => daysAgo(365), to: () => daysAgo(1) },
] as const;

export function DoctorPastAppointmentsPage() {
  const { token, doctorCanCreateAppointments, doctorCanRefer,
    attendedFollowUpDays, attendedReferralDays, missedRescheduleDays, missedReferralDays } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = daysAgo(1);
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [pendingAttendance, setPendingAttendance] = useState<{ id: string; attended: boolean } | null>(null);
  const [dateRange, setDateRange] = useState('month');
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(yesterday);
  const [datePanelOpen, setDatePanelOpen] = useState(() => window.innerWidth >= 1024);
  const [calendarDropdownOpen, setCalendarDropdownOpen] = useState(false);
  const calendarDropdownRef = useRef<HTMLDivElement>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (calendarDropdownRef.current && !calendarDropdownRef.current.contains(e.target as Node)) setCalendarDropdownOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cacheKey = `appointments:past:${dateFrom}:${dateTo}`;
  const { data: raw, loading, error, refresh: fetchAppointments, backgroundRefresh } = useCachedData(
    cacheKey,
    useCallback(() => api.listAppointments({ from: dateFrom, to: dateTo }, token), [token, dateFrom, dateTo]),
    { enabled: !!token }
  );
  const appointments = raw ?? [];
  const refreshAll = useCallback(() => {
    backgroundRefresh();
  }, [backgroundRefresh]);

  const canSchedule = doctorCanCreateAppointments || doctorCanRefer;
  const scheduleLabel = !doctorCanCreateAppointments && doctorCanRefer ? 'Refer Patient'
    : doctorCanCreateAppointments && !doctorCanRefer ? 'Book a Follow Up'
    : 'New Appointment';
  const forcedScheduleType = !doctorCanCreateAppointments && doctorCanRefer ? 'referral'
    : doctorCanCreateAppointments && !doctorCanRefer ? 'follow-up'
    : undefined;

  const { slideClass: dateSlideClass, handleClose: handleDatePanelClose } = useSlidePanel(datePanelOpen, () => setDatePanelOpen(false), 200);

  const handleDateRangeChange = (key: string) => {
    const opt = dateRangeOptions.find(o => o.key === key);
    if (opt) {
      setDateRange(key);
      setDateFrom(opt.from());
      setDateTo(opt.to());
    }
  };

  const requestAttendance = useCallback((id: string, attended: boolean) => {
    setPendingAttendance({ id, attended });
  }, []);

  const confirmAttendance = useCallback(async (arrivalTime?: string) => {
    if (!pendingAttendance) return;
    try {
      await api.markAttendance(pendingAttendance.id, { attended: pendingAttendance.attended, arrival_time: arrivalTime }, token);
      addToast(pendingAttendance.attended ? 'Attendance marked' : 'Marked as missed', 'success');
      refreshAll();
      setPendingAttendance(null);
      setSelectedAppointment(null);
    } catch (e: any) {
      console.error(e.message);
      setPendingAttendance(null);
    }
  }, [pendingAttendance, token, refreshAll, addToast]);

  const selectedForModal = pendingAttendance
    ? appointments.find(a => a.id === pendingAttendance.id)
    : null;

  const { setContainerClass } = useContentContainer();
  const panelOpen = datePanelOpen || !!selectedAppointment;

  useEffect(() => {
    setContainerClass(panelOpen
      ? 'max-w-[2000px] lg:max-w-[calc(80rem+480px)] mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200'
      : 'max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
    return () => setContainerClass('max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
  }, [panelOpen, setContainerClass]);

  const statuses = [
    { key: 'all', label: `All (${appointments.length})`, color: '' },
    { key: 'attended', label: 'Attended', color: 'bg-emerald-500' },
    { key: 'missed', label: 'Missed', color: 'bg-purple-500' },
    { key: 'cancelled', label: 'Cancelled', color: 'bg-slate-300' },
  ];

  const filtered = appointments.filter(a => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'attended') return a.attended === true;
    if (statusFilter === 'missed') return a.attended === false;
    if (statusFilter === 'cancelled') return a.status === 'cancelled';
    return true;
  }).filter(a => !filterDate || a.slot_date === filterDate).filter(a => {
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

  const groupedByDate = filtered.reduce((acc, a) => {
    if (!acc[a.slot_date]) acc[a.slot_date] = [];
    acc[a.slot_date].push(a);
    return acc;
  }, {} as Record<string, AppointmentHistoryItem[]>);

  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  const currentRange = dateRangeOptions.find(o => o.key === dateRange);

  const eventDates = useMemo(() => {
    return new Set(appointments.map(a => a.slot_date));
  }, [appointments]);

  return (
    <div className={`space-y-6 transition-[margin-right] duration-200 ${panelOpen ? 'lg:mr-[480px]' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Past Appointments"
          description={currentRange ? `${currentRange.label}` : `${appointments.length} past appointment${appointments.length !== 1 ? 's' : ''}`}
          icon={TimeScheduleIcon}
        />
        <div className="flex items-center gap-2 shrink-0 self-start pt-1">
          <RefreshButton onClick={refreshAll} />
          <button
            onClick={() => { setSelectedAppointment(null); if (datePanelOpen) { handleDatePanelClose(); } else { setDatePanelOpen(true); } }}
            className={`hidden lg:flex w-12 h-12 items-center justify-center rounded-lg border bg-card shadow-sm transition-all ${
              datePanelOpen
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-100/50'
                : 'border-slate-200 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <HugeiconsIcon icon={Calendar01Icon} className="size-5" />
          </button>
          <div className="relative" ref={calendarDropdownRef}>
            <button
              onClick={() => setCalendarDropdownOpen(v => !v)}
              className={`lg:hidden w-12 h-12 flex items-center justify-center rounded-lg border bg-card shadow-sm transition-all ${
                filterDate || calendarDropdownOpen
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-100/50'
                  : 'border-slate-200 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <HugeiconsIcon icon={Calendar01Icon} className="size-5" />
            </button>
            {calendarDropdownOpen && (
              <div className="fixed inset-0 z-50 lg:absolute lg:inset-auto lg:right-0 lg:top-full lg:mt-1.5 flex items-center justify-center lg:block">
                <div className="absolute inset-0 bg-black/30 lg:hidden" onClick={() => setCalendarDropdownOpen(false)} />
                <div className="relative bg-card border border-border rounded-xl shadow-xl p-4 w-[calc(100vw-2rem)] max-w-[360px] mx-4 lg:mx-0 lg:w-auto lg:min-w-[280px]">
                  <MiniCalendar
                    date={filterDate ? new Date(filterDate + 'T12:00:00') : new Date()}
                    selectedDate={filterDate ? new Date(filterDate + 'T12:00:00') : null}
                    onDateChange={(d) => {
                      const dateStr = format(d, 'yyyy-MM-dd');
                      setFilterDate(filterDate === dateStr ? null : dateStr);
                      setCalendarDropdownOpen(false);
                    }}
                  />
                  {filterDate && (
                    <button onClick={() => { setFilterDate(null); setCalendarDropdownOpen(false); }}
                      className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-md hover:bg-muted transition-colors">
                      Show all
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      {error && <ErrorAlert message={error} variant="compact" />}
      </div>

      <div className="flex items-start justify-between gap-2 flex-wrap">
        <SearchFilterBar
          value={searchQuery}
          onChange={setSearchQuery}
          filterValue={searchFilter}
          onFilterChange={setSearchFilter}
          placeholderMap={placeholderMap}
          filterOptions={filterOptions}
        />
        <div className="flex items-center gap-1 flex-wrap shrink-0 mt-2 sm:mt-0">
          {statuses.map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === s.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {s.color && <div className={`size-1.5 rounded-full ${s.color}`} />}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
          <div className="p-8"><div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Calendar01Icon} title="No past appointments" description={statusFilter !== 'all' ? 'No appointments match the selected filter.' : 'No appointments found for the selected date range.'} />
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => {
              const rows = groupedByDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time));
              return (
                <div key={date} className="rounded-lg">
                  <div className="sticky top-0 z-10 bg-background px-5 py-3">
                    <span className="text-sm font-bold text-foreground uppercase tracking-wider">{formatDate(date)}</span>
                    <span className="ml-2.5 text-xs text-muted-foreground font-medium">{rows.length} appointment{rows.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="bg-card rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)]">
                    <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                      <tbody>
                        {rows.map(a => {
                          const isAttended = a.attended === true;
                          const isMissed = a.attended === false;
                          const isCancelled = a.status === 'cancelled';
                          const isPending = !isAttended && !isMissed && !isCancelled;
                          const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : isCancelled ? '#cbd5e1' : a.has_conflict ? '#ef4444' : '#9333ea';
                          const canAttend = isPending;
                          return (
                            <tr key={a.id}
                              className={`rounded-lg cursor-pointer transition-all duration-150 hover:bg-muted/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0 ${a.has_conflict ? 'bg-red-50/30 dark:bg-red-950/30' : ''}`}
                              onClick={() => setSelectedAppointment(a)}
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
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {formatDate(a.slot_date)} · Dr. {a.doctor_name}
                                  {a.notes && <span className="ml-2 text-muted-foreground/30">· {a.notes}</span>}
                                </div>
                              </td>
                              <td className="w-[100px] py-4 border-b border-border align-top">
                                <StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} start_time={a.start_time} arrival_time={a.arrival_time} slot_date={a.slot_date} has_conflict={a.has_conflict} />
                              </td>
                              <td className="pr-3 w-0 py-4 border-b border-border align-top">
                                {canAttend ? (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button onClick={e => { e.stopPropagation(); requestAttendance(a.id, true); }}
                                      className="p-1.5 rounded-md text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors" title="Mark attended"
                                    ><HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" /></button>
                                    <button onClick={e => { e.stopPropagation(); requestAttendance(a.id, false); }}
                                      className="p-1.5 rounded-md text-red-400 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors" title="Mark missed"
                                    ><HugeiconsIcon icon={Cancel01Icon} className="size-4" /></button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <button onClick={e => { e.stopPropagation(); setSelectedAppointment(a); }}
                                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                                    ><HugeiconsIcon icon={ArrowRight01Icon} className="size-4" /></button>
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

      <DateRangeSlidePanel
        open={datePanelOpen}
        slideClass={dateSlideClass}
        filterDate={filterDate}
        onFilterDate={(d) => {
          setFilterDate(d);
          if (d) { setDateFrom(d); setDateTo(d); setDateRange('custom'); }
        }}
        onClose={handleDatePanelClose}
        eventDates={eventDates}
        dateRangeOptions={dateRangeOptions}
        selectedRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
      />

    </div>
  );
}
