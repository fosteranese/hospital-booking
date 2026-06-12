import { useState, useCallback, useMemo, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { useCachedData } from '@/hooks/useCachedData';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useContentContainer } from '@/pages/dashboard/DashboardLayout';
import { useToast } from '@/contexts/toast-context';
import { PageHeader } from '@/components/PageHeader';
import { UnavailabilityConflictBanner } from '@/components/UnavailabilityConflictBanner';
import { RefreshButton } from '@/components/RefreshButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { EventDetailModal } from '@/components/EventDetailModal';
import { CreateAppointmentModal } from '@/components/CreateAppointmentModal';
import { AppointmentSlidePanel } from '@/components/AppointmentSlidePanel';
import { ConfirmAttendanceModal } from '@/components/ConfirmAttendanceModal';
import { RescheduleModal } from '@/components/RescheduleModal';
import { ScheduleModal } from '@/components/ScheduleModal';
import { CalendarSlidePanel } from '@/components/CalendarSlidePanel';
import { DayView } from '@/components/calendar/DayView';
import { WeekView } from '@/components/calendar/WeekView';
import { MonthView } from '@/components/calendar/MonthView';
import { YearView } from '@/components/calendar/YearView';
import { CalendarListView } from '@/components/calendar/CalendarListView';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, FilterIcon } from '@hugeicons/core-free-icons';
import { isBeforeToday } from '@/lib/helpers';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'attended', label: 'Attended' },
  { value: 'missed', label: 'Missed' },
  { value: 'conflicts', label: 'Conflicts' },
];

const VIEWS = ['day', 'week', 'month', 'year'] as const;

export function CalendarPage() {
  const { token, userRole, doctorCanCreateAppointments, doctorCanRefer,
    attendedFollowUpDays, attendedReferralDays, missedRescheduleDays, missedReferralDays } = useAuth();
  const { addToast } = useToast();
  const isAdminScheduler = userRole === 'admin' || userRole === 'scheduler';
  const canSchedule = doctorCanCreateAppointments || doctorCanRefer;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>('calendar');
  const [statusFilter, setStatusFilter] = useState('all');

  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(() => window.innerWidth >= 1024);

  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [createStartTime, setCreateStartTime] = useState('');

  const [pendingAttendance, setPendingAttendance] = useState<{ id: string; attended: boolean } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<AppointmentHistoryItem | null>(null);

  const dateRange = useMemo(() => {
    const d = currentDate;
    if (displayMode === 'list') {
      const from = format(subMonths(d, 1), 'yyyy-MM-dd');
      const to = format(addMonths(d, 1), 'yyyy-MM-dd');
      return { from, to };
    }
    if (currentView === 'year') {
      return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
    }
    if (currentView === 'month') {
      return { from: format(startOfMonth(d), 'yyyy-MM-dd'), to: format(endOfMonth(d), 'yyyy-MM-dd') };
    }
    if (currentView === 'week') {
      return { from: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd') };
    }
    return { from: format(d, 'yyyy-MM-dd'), to: format(d, 'yyyy-MM-dd') };
  }, [currentDate, currentView, displayMode]);

  const cacheKey = `appointments:calendar:${dateRange.from}:${dateRange.to}:${displayMode}`;

  const { data: rawAppointments, loading, error, backgroundRefresh } = useCachedData(
    cacheKey,
    useCallback(() => api.listAppointments({ from: dateRange.from, to: dateRange.to }, token), [token, dateRange.from, dateRange.to]),
    { enabled: !!token }
  );
  const appointments = useMemo(() => {
    const all = (rawAppointments ?? []).filter(a => a.status !== 'cancelled');
    if (statusFilter === 'all' || !statusFilter) return all;
    if (statusFilter === 'pending') return all.filter(a => a.attended === null && !isBeforeToday(a.slot_date));
    if (statusFilter === 'attended') return all.filter(a => a.attended === true);
    if (statusFilter === 'missed') return all.filter(a => {
      if (a.attended === false) return true;
      if (a.attended === null && isBeforeToday(a.slot_date)) return true;
      return false;
    });
    if (statusFilter === 'conflicts') return all.filter(a => a.has_conflict);
    return all;
  }, [rawAppointments, statusFilter]);

  const refreshAll = useCallback(() => { backgroundRefresh(); }, [backgroundRefresh]);

  const { setContainerClass } = useContentContainer();
  const panelOpen = calendarOpen || !!selectedAppointment;

  useEffect(() => {
    setContainerClass(panelOpen
      ? 'max-w-[2000px] lg:max-w-[calc(80rem+480px)] mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200'
      : 'max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
    return () => setContainerClass('max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
  }, [panelOpen, setContainerClass]);

  const dateLabel = useMemo(() => {
    const d = currentDate;
    if (displayMode === 'list') return format(d, 'MMMM yyyy');
    if (currentView === 'year') return String(d.getFullYear());
    if (currentView === 'month') return format(d, 'MMMM yyyy');
    if (currentView === 'week') {
      const mon = startOfWeek(d, { weekStartsOn: 1 });
      const sun = endOfWeek(d, { weekStartsOn: 1 });
      return `${format(mon, 'MMM d')} – ${format(sun, 'MMM d, yyyy')}`;
    }
    return format(d, 'EEEE, MMMM d, yyyy');
  }, [currentDate, currentView, displayMode]);

  const handlePrev = useCallback(() => {
    const d = new Date(currentDate);
    if (displayMode === 'list') { d.setMonth(d.getMonth() - 1); }
    else if (currentView === 'year') d.setFullYear(d.getFullYear() - 1);
    else if (currentView === 'month') d.setMonth(d.getMonth() - 1);
    else if (currentView === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
    setFilterDate(format(d, 'yyyy-MM-dd'));
  }, [currentDate, currentView, displayMode]);

  const handleNext = useCallback(() => {
    const d = new Date(currentDate);
    if (displayMode === 'list') { d.setMonth(d.getMonth() + 1); }
    else if (currentView === 'year') d.setFullYear(d.getFullYear() + 1);
    else if (currentView === 'month') d.setMonth(d.getMonth() + 1);
    else if (currentView === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
    setFilterDate(format(d, 'yyyy-MM-dd'));
  }, [currentDate, currentView, displayMode]);

  const handleToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    setFilterDate(format(today, 'yyyy-MM-dd'));
    if (displayMode === 'list' && currentView !== 'month') setCurrentView('month');
  }, [displayMode, currentView]);

  const handleFilterDate = useCallback((d: string | null) => {
    setFilterDate(d);
    if (d) {
      const dateStr = d.includes('_') ? d.split('_')[0] : d;
      setCurrentDate(new Date(dateStr + 'T12:00:00'));
    } else {
      const today = new Date();
      setCurrentDate(today);
      setFilterDate(format(today, 'yyyy-MM-dd'));
    }
  }, []);

  /* ── Calendar mode event/slot handlers ── */

  const handleEventClick = useCallback((appt: AppointmentHistoryItem) => {
    setSelectedAppointment(appt);
    setDetailOpen(true);
  }, []);

  const handleSlotClick = useCallback((date: Date, startTime?: string) => {
    if (!isAdminScheduler) return;
    setCreateDate(date);
    setCreateStartTime(startTime || '09:00');
    setCreateOpen(true);
  }, [isAdminScheduler]);

  const handleDayClick = useCallback((date: Date) => {
    setCurrentDate(date);
    setCurrentView('day');
  }, []);

  const handleMonthClick = useCallback((date: Date) => {
    setCurrentDate(date);
    setCurrentView('month');
  }, []);

  /* ── List mode handlers ── */

  const handleSelectAppointment = useCallback((appt: AppointmentHistoryItem) => {
    setSelectedAppointment(appt);
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

  /* ── EventDetailModal handlers ── */

  const handleUpdateEvent = useCallback(async (data: { attended?: boolean | null; notes?: string }) => {
    if (!selectedAppointment) return;
    if (data.notes !== undefined) {
      await api.updateAppointment(selectedAppointment.id, { notes: data.notes }, token);
    }
    if (data.attended !== selectedAppointment.attended && data.attended !== undefined && data.attended !== null) {
      await api.markAttendance(selectedAppointment.id, { attended: data.attended }, token);
    }
    await backgroundRefresh();
  }, [selectedAppointment, token, backgroundRefresh]);

  const handleDeleteEvent = useCallback(async () => {
    if (!selectedAppointment) return;
    await api.cancelAppointment(selectedAppointment.id, { cancellation_reason: 'Cancelled by staff' }, token);
    setDetailOpen(false);
    setSelectedAppointment(null);
    await backgroundRefresh();
  }, [selectedAppointment, token, backgroundRefresh]);

  const handleCreateAppointment = useCallback(async (data: {
    patient_id: string; doctor_id: string; slot_date: string;
    start_time: string; end_time: string; notes?: string;
  }) => {
    await api.createAppointment(data, token);
    await backgroundRefresh();
  }, [token, backgroundRefresh]);

  /* ── Derived data for slide panel ── */

  const eventDates = useMemo(() => new Set(appointments.map(a => a.slot_date)), [appointments]);

  const selectedForAttendance = pendingAttendance
    ? appointments.find(a => a.id === pendingAttendance.id) ?? null
    : null;

  /* ── View switcher label ── */
  const viewHeader = displayMode === 'list' ? 'List' : VIEWS.find(v => v === currentView) ? currentView.charAt(0).toUpperCase() + currentView.slice(1) : '';

  return (
    <div className={`space-y-6 transition-[margin-right] duration-200 ${
      panelOpen ? 'lg:mr-[480px]' : ''
    }`}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Calendar"
          description={viewHeader ? `${viewHeader} view · ${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}` : `${appointments.length} appointments`}
          icon={Calendar01Icon}
        />
        <div className="flex items-center gap-2 shrink-0 self-start pt-1">
          {/* Status filter */}
          <div className="flex items-center gap-2 h-12 border border-border rounded-lg px-3 bg-card shadow-sm">
            <HugeiconsIcon icon={FilterIcon} className="size-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm text-foreground focus:outline-none cursor-pointer"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* Display mode toggle */}
          <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-card shadow-sm h-12">
            <button
              onClick={() => setDisplayMode('calendar')}
              className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${displayMode === 'calendar' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Calendar view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => setDisplayMode('list')}
              className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${displayMode === 'list' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="List view"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
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
      </div>

      <UnavailabilityConflictBanner />

      {error && <ErrorAlert message={error} variant="compact" />}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          {/* Nav buttons + Today (calendar only) */}
          {displayMode === 'calendar' && (
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Previous"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-foreground min-w-[160px] text-center select-none">
                {dateLabel}
              </span>
              <button
                onClick={handleNext}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Next"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <button
                onClick={handleToday}
                className="ml-1 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border"
              >
                Today
              </button>
            </div>
          )}

          {/* View switcher (calendar only) */}
          {displayMode === 'calendar' && (
            <div className="flex items-center gap-1 ml-auto">
              {VIEWS.map(v => (
                <button
                  key={v}
                  onClick={() => setCurrentView(v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                    currentView === v
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendar views */}
      {displayMode === 'calendar' ? (
        <>
          {currentView === 'day' && (
            <DayView
              appointments={appointments}
              currentDate={currentDate}
              loading={loading}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )}
          {currentView === 'week' && (
            <WeekView
              appointments={appointments}
              currentDate={currentDate}
              loading={loading}
              onEventClick={handleEventClick}
              onSlotClick={handleSlotClick}
            />
          )}
          {currentView === 'month' && (
            <MonthView
              appointments={appointments}
              currentDate={currentDate}
              loading={loading}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
          )}
          {currentView === 'year' && (
            <YearView
              appointments={appointments}
              currentDate={currentDate}
              loading={loading}
              onMonthClick={handleMonthClick}
            />
          )}
        </>
      ) : (
        <CalendarListView
          appointments={appointments}
          loading={loading}
          onSelectAppointment={handleSelectAppointment}
          onRequestAttendance={requestAttendance}
        />
      )}

      {/* Modals — Calendar mode */}
      <EventDetailModal
        event={selectedAppointment ? {
          id: selectedAppointment.id,
          patient_name: selectedAppointment.patient_name,
          doctor_name: selectedAppointment.doctor_name,
          specialization: selectedAppointment.specialization,
          start: new Date(selectedAppointment.slot_date + 'T' + selectedAppointment.start_time),
          end: new Date(selectedAppointment.slot_date + 'T' + selectedAppointment.end_time),
          status: selectedAppointment.status,
          attended: selectedAppointment.attended,
          notes: selectedAppointment.notes || '',
          cancellation_reason: selectedAppointment.cancellation_reason || '',
        } : null}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedAppointment(null); }}
        onUpdate={handleUpdateEvent}
        onDelete={handleDeleteEvent}
      />

      <CreateAppointmentModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreateDate(null); setCreateStartTime(''); }}
        onCreate={handleCreateAppointment}
        selectedDate={createDate ?? currentDate}
        selectedStartTime={createStartTime || undefined}
        token={token}
      />

      {/* Modals — List mode */}
      {selectedAppointment && displayMode === 'list' && (
        <AppointmentSlidePanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onRequestAttendance={requestAttendance}
          onReschedule={setRescheduleTarget}
          onScheduleNew={canSchedule ? setScheduleTarget : undefined}
          canSchedule={canSchedule}
          scheduleLabel={!doctorCanCreateAppointments && doctorCanRefer ? 'Refer Patient'
            : doctorCanCreateAppointments && !doctorCanRefer ? 'Book a Follow Up'
            : 'New Appointment'}
          forcedScheduleType={!doctorCanCreateAppointments && doctorCanRefer ? 'referral'
            : doctorCanCreateAppointments && !doctorCanRefer ? 'follow-up'
            : undefined}
          attendedFollowUpDays={attendedFollowUpDays}
          attendedReferralDays={attendedReferralDays}
          missedRescheduleDays={missedRescheduleDays}
          missedReferralDays={missedReferralDays}
        />
      )}

      <CalendarSlidePanel
        open={calendarOpen}
        filterDate={filterDate}
        onFilterDate={handleFilterDate}
        eventDates={eventDates}
        onClose={() => setCalendarOpen(false)}
      />

      {selectedForAttendance && (
        <ConfirmAttendanceModal
          open={!!pendingAttendance}
          patientName={selectedForAttendance.patient_name}
          slotDate={selectedForAttendance.slot_date}
          startTime={selectedForAttendance.start_time}
          endTime={selectedForAttendance.end_time}
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
      />
    </div>
  );
}
