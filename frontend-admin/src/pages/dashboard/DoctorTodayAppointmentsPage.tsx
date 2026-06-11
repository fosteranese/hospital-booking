import { useState, useEffect, useCallback, useRef } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useContentContainer } from '@/pages/dashboard/DashboardLayout';
import { useCachedData } from '@/hooks/useCachedData';

import { AppointmentSlidePanel } from '@/components/AppointmentSlidePanel';
import { ConfirmAttendanceModal } from '@/components/ConfirmAttendanceModal';
import { RescheduleModal } from '@/components/RescheduleModal';
import { ScheduleModal } from '@/components/ScheduleModal';
import { UnavailabilityConflictBanner } from '@/components/UnavailabilityConflictBanner';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
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
import { formatTime, PatientAvatar } from '@/lib/helpers';
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

export function DoctorTodayAppointmentsPage() {
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
  const today = new Date().toISOString().slice(0, 10);

  const { data: rawToday, loading: todayLoading, error: todayError, refresh: fetchToday, backgroundRefresh } = useCachedData(
    `appointments:today:${today}`,
    useCallback(() => api.listAppointments({ date: today }, token), [token, today]),
    { enabled: !!token }
  );
  const todayAppts = rawToday ?? [];
  const refreshAll = useCallback(() => {
    backgroundRefresh();
  }, [backgroundRefresh]);

  const now = new Date();

  const handleAttendance = async (id: string, attended: boolean) => {
    try {
      const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const arrivalIso = `${today}T${nowStr}:00`;
      await api.markAttendance(id, { attended, arrival_time: arrivalIso }, token);
      refreshAll();
    } catch (e: any) {
      console.error(e.message);
    }
  };

  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [pendingAttendance, setPendingAttendance] = useState<{
    id: string;
    attended: boolean;
  } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<AppointmentHistoryItem | null>(null);

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
      refreshAll();
      setPendingAttendance(null);
      setSelectedAppointment(null);
    } catch (e: any) {
      console.error(e.message);
      setPendingAttendance(null);
    }
  }, [pendingAttendance, token, refreshAll, addToast]);

  const selectedForModal = pendingAttendance
    ? todayAppts.find(a => a.id === pendingAttendance.id)
    : null;

  const { setContainerClass } = useContentContainer();

  useEffect(() => {
    setContainerClass(selectedAppointment
      ? 'max-w-[2000px] lg:max-w-[calc(80rem+480px)] mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200'
      : 'max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
    return () => setContainerClass('max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
  }, [selectedAppointment, setContainerClass]);

  const statuses = [
    { key: 'confirmed', label: 'Pending', color: 'bg-amber-400' },
    { key: 'attended', label: 'Attended', color: 'bg-emerald-500' },
    { key: 'missed', label: 'Missed', color: 'bg-purple-500' },
    { key: 'cancelled', label: 'Cancelled', color: 'bg-slate-300' },
    { key: 'all', label: `All (${todayAppts.length})`, color: '' },
  ];

  const filtered = todayAppts.filter(a => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'confirmed') return a.status !== 'cancelled' && a.attended === null;
    if (statusFilter === 'attended') return a.attended === true;
    if (statusFilter === 'missed') return a.attended === false;
    if (statusFilter === 'cancelled') return a.status === 'cancelled';
    return true;
  }).filter(a => {
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

  return (
    <div className={`space-y-6 transition-[margin-right] duration-200 ${
      selectedAppointment ? 'lg:mr-[480px]' : ''
    }`}>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Today's Appointments"
          description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          icon={Calendar01Icon}
        />
        <div className="flex items-center gap-2 shrink-0 self-start pt-1">
          <button onClick={refreshAll} className="w-12 h-12 flex items-center justify-center rounded-lg border border-border bg-card shadow-sm hover:bg-muted transition-all" title="Refresh data">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5 text-muted-foreground">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
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
                {filterOptions.map((opt, i) => (
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
          {statuses.map(s => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
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

      {todayError && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {todayError}
        </div>
      )}

      <Card padding="none">
        {todayLoading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
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
          <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <tbody>
              {filtered
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map(a => {
                  const isAttended = a.attended === true;
                  const isMissed = a.attended === false;
                  const isCancelled = a.status === 'cancelled';
                  const isPending = !isAttended && !isMissed && !isCancelled && (() => {
                    const [h, m] = a.end_time.split(':').map(Number);
                    const slotEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
                    return new Date() >= slotEnd;
                  })();
                  const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : isCancelled ? '#cbd5e1' : a.has_conflict ? '#ef4444' : '#f59e0b';

                  return (
                    <tr
                      key={a.id}
                    className={`cursor-pointer transition-all duration-150 hover:bg-muted/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0 ${a.has_conflict ? 'bg-red-50/30' : ''}`}
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
                          {a.has_conflict && <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 text-red-500 shrink-0" />}
                          {a.referring_doctor_id && (
                            <span title={a.referring_doctor_name ? `Referred by Dr. ${a.referring_doctor_name}` : 'Referred by another doctor'}>
                              <HugeiconsIcon icon={UserGroupIcon} className="size-3.5 text-violet-500 shrink-0" />
                            </span>
                          )}
                          {a.referring_doctor_name && <span className="text-xs text-violet-400 ml-0.5">(ref. Dr. {a.referring_doctor_name})</span>}
                        </div>
                        {a.notes && <div className="text-xs text-muted-foreground truncate mt-0.5">{a.notes}</div>}
                      </td>
                      <td className="w-[100px] py-4 border-b border-border align-top"><StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} start_time={a.start_time} arrival_time={a.arrival_time} slot_date={a.slot_date} has_conflict={a.has_conflict} /></td>
                      <td className="pr-3 w-0 py-4 border-b border-border align-top">
                        {isPending ? (
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
        )}
      </Card>

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
    </div>
  );
}
