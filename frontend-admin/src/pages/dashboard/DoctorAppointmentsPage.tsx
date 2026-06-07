import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useContentContainer } from '@/pages/dashboard/DashboardLayout';
import { AppointmentSlidePanel } from '@/components/AppointmentSlidePanel';
import { ConfirmAttendanceModal } from '@/components/ConfirmAttendanceModal';
import { RescheduleModal } from '@/components/RescheduleModal';
import { ScheduleModal } from '@/components/ScheduleModal';
import { UnavailabilityConflictBanner } from '@/components/UnavailabilityConflictBanner';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import { format } from 'date-fns';
import { MiniCalendar } from '@/components/MiniCalendar';
import {
  Calendar01Icon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  ArrowRight01Icon,
  Search01Icon,
  ChevronDownIcon,
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

function StatusDot({ status, attended, minutes_late, has_conflict }: { status: string; attended: boolean | null; minutes_late: number | null; has_conflict?: boolean }) {
  if (has_conflict) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-red-500 shrink-0" />
        <span className="text-xs text-red-600 font-medium">Conflict</span>
      </div>
    );
  }
  if (attended === true) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full bg-emerald-500 shrink-0" />
        <span className="text-xs text-emerald-600 font-medium">
          Attended{minutes_late ? ` (${minutes_late}m late)` : ''}
        </span>
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
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [calendarDropdownOpen, setCalendarDropdownOpen] = useState(false);
  const calendarDropdownRef = useRef<HTMLDivElement>(null);
  const [pendingAttendance, setPendingAttendance] = useState<{
    id: string;
    attended: boolean;
  } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [conflictFilter, setConflictFilter] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAppointments({}, token);
      const upcoming = data.filter(a => a.slot_date >= today);
      upcoming.sort((a, b) => {
        if (a.slot_date !== b.slot_date) return a.slot_date.localeCompare(b.slot_date);
        return a.start_time.localeCompare(b.start_time);
      });
      setAppointments(upcoming);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, today]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (calendarDropdownRef.current && !calendarDropdownRef.current.contains(e.target as Node)) {
        setCalendarDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const requestAttendance = useCallback((id: string, attended: boolean) => {
    setPendingAttendance({ id, attended });
  }, []);

  const confirmAttendance = useCallback(async (minutesLate?: number) => {
    if (!pendingAttendance) return;
    try {
      await api.markAttendance(pendingAttendance.id, { attended: pendingAttendance.attended, minutes_late: minutesLate }, token);
      setAppointments(prev => prev.map(a => a.id === pendingAttendance.id ? { ...a, attended: pendingAttendance.attended, status: 'confirmed' } : a));
      setPendingAttendance(null);
      setSelectedAppointment(null);
    } catch (e: any) {
      setError(e.message);
      setPendingAttendance(null);
    }
  }, [pendingAttendance, token]);

  const selectedForModal = pendingAttendance
    ? appointments.find(a => a.id === pendingAttendance.id)
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

  const filtered = appointments.filter(a => a.attended === null).filter(a => !filterDate || a.slot_date === filterDate).filter(a => !conflictFilter || a.has_conflict).filter(a => {
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
          <button
            onClick={() => { setSelectedAppointment(null); setCalendarOpen(v => !v); }}
            className={`hidden lg:flex w-12 h-12 items-center justify-center rounded-lg border bg-white shadow-sm transition-all ${
              filterDate || calendarOpen
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-100/50'
                : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <HugeiconsIcon icon={Calendar01Icon} className="size-5" />
          </button>
          <button
            onClick={() => setCalendarDropdownOpen(v => !v)}
            className={`lg:hidden w-12 h-12 flex items-center justify-center rounded-lg border bg-white shadow-sm transition-all ${
              filterDate || calendarDropdownOpen
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-100/50'
                : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <HugeiconsIcon icon={Calendar01Icon} className="size-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3.5 py-2.5 rounded-lg">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <UnavailabilityConflictBanner />

      <div className="flex items-center justify-between gap-2">
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
            <button
              onClick={() => setSearchQuery('')}
              className="shrink-0 mr-1.5 p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          )}
          <div className="relative p-1.5" ref={filterRef}>
            <button
              onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 h-full rounded-md py-1.5 px-2.5 text-xs font-medium text-slate-600 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 transition-all whitespace-nowrap"
            >
              {currentFilter?.label}
              <HugeiconsIcon icon={ChevronDownIcon} className={`size-3 transition-transform duration-150 ${filterOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-1.5 min-w-[8rem] bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1.5 overflow-hidden">
                {filterOptions.map(opt => (
                  <button
                    key={opt.value}
                    onMouseDown={e => { e.preventDefault(); setSearchFilter(opt.value); setFilterOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors ${
                      opt.value === searchFilter
                        ? 'bg-emerald-50 text-emerald-600 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
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
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {f.color && <div className={`size-1.5 rounded-full ${f.color}`} />}
              {f.label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                (f.key === 'conflicts' && conflictFilter) || (f.key === 'all' && !conflictFilter)
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      {calendarDropdownOpen && (
          <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 min-w-[280px]">
              <MiniCalendar
                date={filterDate ? new Date(filterDate + 'T12:00:00') : new Date()}
                selectedDate={filterDate ? new Date(filterDate + 'T12:00:00') : null}
                onDateChange={(d) => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  setFilterDate(filterDate === dateStr ? null : dateStr);
                  setCalendarDropdownOpen(false);
                }}
                eventDates={eventDates}
              />
              {filterDate && (
                <button onClick={() => { setFilterDate(null); setCalendarDropdownOpen(false); }}
                  className="mt-3 w-full text-xs text-slate-500 hover:text-slate-700 py-1.5 rounded-md hover:bg-slate-50 transition-colors">
                  Show all appointments
                </button>
              )}
            </div>
          )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div>
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
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
                    <span className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      {isToday(date) ? `Today – ${todayLabel}` : isTomorrow(date) ? `Tomorrow – ${todayLabel}` : formatDate(date)}
                    </span>
                    <span className="ml-2.5 text-xs text-slate-400 font-medium">
                      {rows.length} appointment{rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)]">
                  <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <tbody>
                      {rows.map(a => {
                        const isAttended = a.attended === true;
                        const isMissed = a.attended === false;
                        const isPending = !isAttended && !isMissed;
                        const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : a.has_conflict ? '#ef4444' : '#f59e0b';
                        const canAttend = isToday(a.slot_date) && isPending;

                        return (
                          <tr
                            key={a.id}
                            className={`cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0 ${a.has_conflict ? 'bg-red-50/30' : ''}`}
                            onClick={() => selectAppointment(a)}
                            style={{ transformOrigin: 'center' }}
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
                              <div className="flex items-center gap-1.5">
                                <div className="text-base font-medium text-slate-900 truncate">{a.patient_name || 'Patient'}</div>
                                {a.has_conflict && <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 text-red-500 shrink-0" />}
                              </div>
                              {a.notes && <div className="text-xs text-slate-400 truncate mt-0.5">{a.notes}</div>}
                            </td>
                            <td className="w-[100px] py-4 border-b border-slate-100 align-top">
                              <StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} has_conflict={a.has_conflict} />
                            </td>
                            <td className="pr-3 w-0 py-4 border-b border-slate-100 align-top">
                              {canAttend ? (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    onClick={e => { e.stopPropagation(); requestAttendance(a.id, true); }}
                                    className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
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
                                    className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
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
                                    className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
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
          onScheduleNew={setScheduleTarget}
        />
      )}

      <CalendarSlidePanel
        open={calendarOpen}
        filterDate={filterDate}
        onFilterDate={setFilterDate}
        eventDates={eventDates}
        onClose={() => setCalendarOpen(false)}
      />

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
      />
    </div>
  );
}

function CalendarSlidePanel({
  open,
  filterDate,
  onFilterDate,
  eventDates,
  onClose,
}: {
  open: boolean;
  filterDate: string | null;
  onFilterDate: (d: string | null) => void;
  eventDates: Set<string>;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    } else {
      setVisible(false);
    }
  }, [open]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose(), 200);
  };

  const slideClass = visible ? 'translate-x-0' : 'translate-x-full';

  return (
    <div className={`hidden lg:block fixed top-0 right-0 h-full w-full lg:w-[480px] bg-white border-l border-slate-200 z-40 flex flex-col transition-transform duration-200 ease-out ${slideClass}`}>
      <div className="flex items-center justify-between px-7 pt-5 pb-2 shrink-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-[0.12em]">Calendar</span>
        <button onClick={handleClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-7 pb-6">
        <div className="pt-6">
          <MiniCalendar
            variant="sidebar"
            date={filterDate ? new Date(filterDate + 'T12:00:00') : new Date()}
            selectedDate={filterDate ? new Date(filterDate + 'T12:00:00') : null}
            onDateChange={(d) => {
              const dateStr = format(d, 'yyyy-MM-dd');
              onFilterDate(filterDate === dateStr ? null : dateStr);
            }}
            eventDates={eventDates}
          />
        </div>
        {filterDate && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-3">
              Showing appointments for <span className="text-slate-600 font-medium">{format(new Date(filterDate + 'T12:00:00'), 'MMMM d, yyyy')}</span>
            </p>
            <button onClick={() => onFilterDate(null)}
              className="w-full text-xs text-slate-400 hover:text-slate-600 py-2 rounded-md hover:bg-slate-50 transition-colors border border-slate-100">
              Clear filter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
