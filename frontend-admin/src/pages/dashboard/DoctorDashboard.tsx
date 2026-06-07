import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, AppointmentHistoryItem, DoctorUnavailability, ReferralItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useContentContainer } from '@/pages/dashboard/DashboardLayout';
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
  ArrowRight01Icon,
  Calendar02Icon,
  CheckmarkCircle01Icon,
  Cancel01Icon,
  AlertCircleIcon,
  TimeScheduleIcon,
  Calendar03Icon,
  ArrowUp01Icon,
  ArrowDown01Icon,
  Share08Icon,
  InformationCircleIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function getEffectiveStatus(a: AppointmentHistoryItem): 'attended' | 'missed' | 'confirmed' | 'cancelled' {
  if (a.status === 'cancelled') return 'cancelled';
  if (a.attended === true) return 'attended';
  if (a.attended === false) return 'missed';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const apptDate = new Date(a.slot_date + 'T00:00:00');
  if (apptDate < today) return 'missed';
  const [h, m] = a.end_time.split(':').map(Number);
  const slotEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h, m);
  if (new Date() >= slotEnd) return 'missed';
  return 'confirmed';
}

function StatusDot({ status, attended, minutes_late, has_conflict }: { status: string; attended: boolean | null; minutes_late: number | null; has_conflict?: boolean }) {
  if (has_conflict) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium" title="Conflict">
        <span className="size-1.5 rounded-full bg-red-600" />
        Conflict
      </span>
    );
  }
  const effective = getEffectiveStatus({ status, attended, end_time: '', minutes_late } as AppointmentHistoryItem);
  const map: Record<string, { label: string; color: string }> = {
    attended:  { label: 'Attended',  color: 'bg-emerald-500' },
    missed:    { label: 'Missed',    color: 'bg-purple-500' },
    cancelled: { label: 'Cancelled', color: 'bg-slate-300' },
    confirmed: { label: 'Confirmed', color: 'bg-blue-500' },
  };
  const s = map[effective];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title={s.label}>
      <span className={`size-1.5 rounded-full ${s.color}`} />
      {s.label}
      {attended === true && minutes_late != null && minutes_late > 0 && (
        <span className="text-amber-600 font-medium">{minutes_late} min late</span>
      )}
    </span>
  );
}

function getWeekRange(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

/* ── SVG illustration backgrounds ── */

function PendingSvg({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="100" cy="100" r="55" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="100" cy="100" r="35" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <line x1="100" y1="100" x2="100" y2="50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
      <line x1="100" y1="100" x2="135" y2="115" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.4" />
      <circle cx="100" cy="100" r="4" fill="currentColor" opacity="0.45" />
      <circle cx="160" cy="40" r="6" fill="currentColor" opacity="0.3" />
      <circle cx="40" cy="165" r="4" fill="currentColor" opacity="0.25" />
      <circle cx="170" cy="155" r="3" fill="currentColor" opacity="0.25" />
      <circle cx="50" cy="45" r="2.5" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

function AttendedSvg({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M55 100 L90 135 L150 65" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <circle cx="160" cy="50" r="5" fill="currentColor" opacity="0.35" />
      <circle cx="45" cy="55" r="3.5" fill="currentColor" opacity="0.25" />
      <circle cx="165" cy="150" r="4.5" fill="currentColor" opacity="0.3" />
      <circle cx="40" cy="155" r="6" fill="currentColor" opacity="0.25" />
      <circle cx="130" cy="30" r="2.5" fill="currentColor" opacity="0.15" />
      <circle cx="60" cy="175" r="3" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

function MissedSvg({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <line x1="65" y1="65" x2="135" y2="135" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" />
      <line x1="135" y1="65" x2="65" y2="135" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.4" />
      <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <circle cx="50" cy="40" r="4" fill="currentColor" opacity="0.3" />
      <circle cx="155" cy="155" r="5" fill="currentColor" opacity="0.25" />
      <circle cx="45" cy="135" r="3" fill="currentColor" opacity="0.25" />
      <circle cx="170" cy="60" r="2.5" fill="currentColor" opacity="0.15" />
      <circle cx="80" cy="175" r="4" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

function TotalSvg({ className = 'w-full h-full' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M45 65 L100 30 L155 65 L155 135 L100 170 L45 135 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" opacity="0.3" />
      <line x1="100" y1="30" x2="100" y2="100" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="45" y1="65" x2="100" y2="100" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="155" y1="65" x2="100" y2="100" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <circle cx="100" cy="100" r="4" fill="currentColor" opacity="0.4" />
      <circle cx="40" cy="50" r="3" fill="currentColor" opacity="0.25" />
      <circle cx="160" cy="150" r="4" fill="currentColor" opacity="0.25" />
      <circle cx="50" cy="155" r="2.5" fill="currentColor" opacity="0.15" />
      <circle cx="155" cy="35" r="3.5" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

/* ── Row 1 stat card with linear progress bar ── */

function TodayStatCard({
  label,
  value,
  total,
  icon,
  cardBg,
  borderClass,
  svgBg,
}: {
  label: string;
  value: number;
  total: number;
  icon: any;
  cardBg: string;
  borderClass: string;
  svgBg: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`relative overflow-hidden h-full rounded-xl border ${cardBg} ${borderClass}`}>
      <div className="absolute -bottom-4 -right-4 w-36 h-36 text-white/40">
        {svgBg}
      </div>
      <div className="relative h-full flex flex-col justify-between py-6 px-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[38px] font-bold text-white tracking-tight leading-none">{value}</div>
            <div className="text-sm text-white/70 font-medium mt-2 leading-snug">{label}</div>
          </div>
          <div className="size-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
            <HugeiconsIcon icon={icon} className="size-5 text-white" />
          </div>
        </div>
        <div className="mt-5">
          <div className="h-1.5 w-full rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white/60 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Row 2 stat card with trend ── */

function TrendBadge({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-400">
        —<span className="text-slate-400 ml-0.5">{label}</span>
      </span>
    );
  }
  const isUp = value > 0;
  const isNeutral = value === 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${isNeutral ? 'text-slate-400' : isUp ? 'text-emerald-600' : 'text-red-500'}`}>
      {!isNeutral && (
        <HugeiconsIcon icon={isUp ? ArrowUp01Icon : ArrowDown01Icon} className="size-3" />
      )}
      {isNeutral ? '—' : `${Math.abs(value)}%`}
      <span className="text-slate-400 ml-0.5">{label}</span>
    </span>
  );
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

function FutureStatCard({
  label,
  value,
  trend,
  icon,
  accentClass,
  borderClass,
}: {
  label: string;
  value: number;
  trend: number | null;
  icon: any;
  accentClass: string;
  borderClass: string;
}) {
  return (
    <div className={`relative bg-white overflow-hidden rounded-xl border ${borderClass}`}>
      <div className="py-4.5 px-4">
        <div className="flex items-center gap-4">
          <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}>
            <HugeiconsIcon icon={icon} className="size-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-500 font-medium">{label}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xl font-bold text-slate-900">{value}</span>
              <TrendBadge value={trend} label="vs prev" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Row 2 secondary card with left border ── */

function InfoCard({
  label,
  value,
  subtext,
  icon,
  borderColor,
  className,
  children,
}: {
  label: string;
  value?: string | number;
  subtext?: string;
  icon: any;
  borderColor: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 py-4 px-4 ${className || ''}`} style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
          <HugeiconsIcon icon={icon} className="size-5 text-slate-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-slate-500 font-medium">{label}</div>
          {children ?? (
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold text-slate-900">{value}</span>
              {subtext && <span className="text-xs text-slate-400">{subtext}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DoctorDashboard() {
  const navigate = useNavigate();
  const { token, otpIdentifier, doctorCanCreateAppointments, doctorCanRefer,
    attendedFollowUpDays, attendedReferralDays, missedRescheduleDays, missedReferralDays } = useAuth();
  const canSchedule = doctorCanCreateAppointments || doctorCanRefer;
  const scheduleLabel = !doctorCanCreateAppointments && doctorCanRefer ? 'Refer Patient'
    : doctorCanCreateAppointments && !doctorCanRefer ? 'Book a Follow Up'
    : 'New Appointment';
  const forcedScheduleType = !doctorCanCreateAppointments && doctorCanRefer ? 'referral'
    : doctorCanCreateAppointments && !doctorCanRefer ? 'follow-up'
    : undefined;
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [latenessInput, setLatenessInput] = useState<{ id: string; minutes: number } | null>(null);
  const [pendingAttendance, setPendingAttendance] = useState<{
    id: string;
    attended: boolean;
  } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<AppointmentHistoryItem | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [unavailability, setUnavailability] = useState<DoctorUnavailability[]>([]);
  const [totalConflicts, setTotalConflicts] = useState(0);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAppointments({}, token);
      setAppointments(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  useEffect(() => {
    if (!token) return;
    api.getProfile(token).then(profile => {
      if (profile.doctor_id) {
        setDoctorId(profile.doctor_id);
        api.getDoctorUnavailability(profile.doctor_id, token).then(setUnavailability);
        api.getUnavailabilityConflictSummary(profile.doctor_id, token).then(s => setTotalConflicts(s.total_conflicts));
      }
    });
    api.getReferrals(token).then(setReferrals);
  }, [token]);

  const handleConfirmAttend = useCallback(async (id: string, attended: boolean, minutes_late?: number | null) => {
    try {
      await api.markAttendance(id, { attended, minutes_late }, token);
      setLatenessInput(null);
      fetchAppointments();
    } catch (e: any) {
      setError(e.message || 'Failed to update attendance');
    }
  }, [token, fetchAppointments]);

  const requestAttendance = useCallback((id: string, attended: boolean) => {
    setPendingAttendance({ id, attended });
  }, []);

  const confirmAttendance = useCallback(async (minutesLate?: number) => {
    if (!pendingAttendance) return;
    try {
      await api.markAttendance(pendingAttendance.id, { attended: pendingAttendance.attended, minutes_late: minutesLate }, token);
      setPendingAttendance(null);
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (e: any) {
      setError(e.message || 'Failed to update attendance');
      setPendingAttendance(null);
    }
  }, [pendingAttendance, token, fetchAppointments]);

  const selectedForModal = pendingAttendance
    ? appointments.find(a => a.id === pendingAttendance.id)
    : null;

  const { setContainerClass } = useContentContainer();

  useEffect(() => {
    setContainerClass(selectedAppointment
      ? 'max-w-[2000px] lg:max-w-[calc(80rem+480px)] mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200'
      : 'max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
    return () => setContainerClass('max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
  }, [selectedAppointment, setContainerClass]);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const weekRange = getWeekRange(new Date());
  const prevWeekStart = new Date(new Date(weekRange.start).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const prevWeekEnd = new Date(new Date(weekRange.end).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const now = new Date();
  const monthStart = today.slice(0, 7) + '-01';
  const monthEnd = today.slice(0, 7) + '-' + String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0');
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
  const yearStart = now.getFullYear() + '-01-01';
  const yearEnd = now.getFullYear() + '-12-31';
  const prevYearStart = (now.getFullYear() - 1) + '-01-01';
  const prevYearEnd = (now.getFullYear() - 1) + '-12-31';

  const todayAppts = appointments.filter(a => a.slot_date === today);
  const conflictAppts = appointments.filter(a => a.has_conflict);
  const todayConflicts = todayAppts.filter(a => a.has_conflict);

  const pendingToday = todayAppts.filter(a => getEffectiveStatus(a) === 'confirmed').length;
  const attendedToday = todayAppts.filter(a => getEffectiveStatus(a) === 'attended').length;
  const missedToday = todayAppts.filter(a => getEffectiveStatus(a) === 'missed').length;
  const totalToday = pendingToday + attendedToday + missedToday;

  const tomorrowTotal = appointments.filter(a => a.slot_date === tomorrow && a.status !== 'cancelled').length;
  const todayNonCancelled = appointments.filter(a => a.slot_date === today && a.status !== 'cancelled').length;
  const tomorrowTrend = todayNonCancelled > 0 ? Math.round(((tomorrowTotal - todayNonCancelled) / todayNonCancelled) * 100) : null;

  const thisWeekTotal = appointments.filter(a => a.slot_date >= weekRange.start && a.slot_date <= weekRange.end && a.status !== 'cancelled').length;
  const prevWeekTotal = appointments.filter(a => a.slot_date >= prevWeekStart && a.slot_date <= prevWeekEnd && a.status !== 'cancelled').length;
  const weekTrend = prevWeekTotal > 0 ? Math.round(((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100) : null;

  const thisMonthTotal = appointments.filter(a => a.slot_date >= monthStart && a.slot_date <= monthEnd && a.status !== 'cancelled').length;
  const prevMonthTotal = appointments.filter(a => a.slot_date >= prevMonthStart && a.slot_date <= prevMonthEnd && a.status !== 'cancelled').length;
  const monthTrend = prevMonthTotal > 0 ? Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : null;

  const thisYearTotal = appointments.filter(a => a.slot_date >= yearStart && a.slot_date <= yearEnd && a.status !== 'cancelled').length;
  const prevYearTotal = appointments.filter(a => a.slot_date >= prevYearStart && a.slot_date <= prevYearEnd && a.status !== 'cancelled').length;
  const yearTrend = prevYearTotal > 0 ? Math.round(((thisYearTotal - prevYearTotal) / prevYearTotal) * 100) : null;

  const unavailabilityCount = unavailability.length;
  const todayStr = new Date().toISOString().slice(0, 10);
  const futureUnavailability = [...unavailability]
    .filter(u => u.slot_date >= todayStr)
    .sort((a, b) => a.slot_date.localeCompare(b.slot_date));
  const nextUnavailability = futureUnavailability.length > 0 ? futureUnavailability[0] : null;
  const nextTime = nextUnavailability && nextUnavailability.start_time && nextUnavailability.end_time
    ? `${nextUnavailability.start_time.slice(0, 5)} - ${nextUnavailability.end_time.slice(0, 5)}`
    : 'All day';
  const nextDateFormatted = nextUnavailability
    ? new Date(nextUnavailability.slot_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    : '';
  const outgoingReferrals = referrals.filter(r => r.referring_doctor_id === doctorId && r.attended === null && r.status !== 'cancelled').length;
  const incomingReferrals = referrals.filter(r => r.doctor_id === doctorId && r.referring_doctor_id !== null && r.referring_doctor_id !== doctorId && r.attended === null && r.status !== 'cancelled').length;

  return (
    <div className={`space-y-7 transition-[margin-right] duration-200 ${
      selectedAppointment ? 'lg:mr-[480px]' : ''
    }`}>
      <PageHeader
        title={`Welcome, Dr. ${otpIdentifier ? otpIdentifier.charAt(0).toUpperCase() + otpIdentifier.split('@')[0].slice(1) : 'Doctor'}`}
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        icon={Calendar01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3.5 py-2.5 rounded-lg">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      <UnavailabilityConflictBanner />

      {/* Row 1: Today's stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-1">
          {loading ? (
            <div className="h-full min-h-[148px] bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <TodayStatCard
              label="Pending Today"
              value={pendingToday}
              total={totalToday}
              icon={TimeScheduleIcon}
              cardBg="bg-amber-500"
              borderClass="border-amber-700"
              svgBg={<PendingSvg />}
            />
          )}
        </div>
        <div className="col-span-1">
          {loading ? (
            <div className="h-full min-h-[148px] bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <TodayStatCard
              label="Attended Today"
              value={attendedToday}
              total={totalToday}
              icon={CheckmarkCircle01Icon}
              cardBg="bg-emerald-500"
              borderClass="border-emerald-700"
              svgBg={<AttendedSvg />}
            />
          )}
        </div>
        <div className="col-span-1">
          {loading ? (
            <div className="h-full min-h-[148px] bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <TodayStatCard
              label="Missed Today"
              value={missedToday}
              total={totalToday}
              icon={Cancel01Icon}
              cardBg="bg-purple-500"
              borderClass="border-purple-700"
              svgBg={<MissedSvg />}
            />
          )}
        </div>
        <div className="col-span-1">
          {loading ? (
            <div className="h-full min-h-[148px] bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <TodayStatCard
              label="Total Today"
              value={totalToday}
              total={totalToday}
              icon={Calendar01Icon}
              cardBg="bg-slate-600"
              borderClass="border-slate-700"
              svgBg={<TotalSvg />}
            />
          )}
        </div>
      </div>

      {/* Row 2: Future appointments with trends + info cards */}
      <div>
        <div className="grid grid-cols-2 gap-4 items-start">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Future Appointments</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
            {loading ? (
              <>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-[76px] bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </>
            ) : (
              <>
                <FutureStatCard label="Tomorrow" value={tomorrowTotal} trend={tomorrowTrend} icon={Calendar02Icon} accentClass="bg-sky-500" borderClass="border-sky-200" />
                <FutureStatCard label="This Week" value={thisWeekTotal} trend={weekTrend} icon={Calendar01Icon} accentClass="bg-violet-500" borderClass="border-violet-200" />
                <FutureStatCard label="This Month" value={thisMonthTotal} trend={monthTrend} icon={Calendar03Icon} accentClass="bg-teal-500" borderClass="border-teal-200" />
                <FutureStatCard label="This Year" value={thisYearTotal} trend={yearTrend} icon={Calendar01Icon} accentClass="bg-indigo-500" borderClass="border-indigo-200" />
              </>
            )}
          </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-4">
              <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Other Info</h3>
            </div>
              <div className="grid grid-cols-2 gap-3">
              {loading ? (
                <>
                  <div className="h-[76px] bg-slate-100 rounded-lg animate-pulse" />
                  <div className="h-[76px] bg-slate-100 rounded-lg animate-pulse" />
                </>
              ) : (
              <>
              <div className="bg-white rounded-xl border border-slate-200 py-3 px-5 flex flex-col">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unavailability</span>
                <div className="flex-1 flex items-center justify-start">
                  <span className="text-4xl font-bold text-slate-900">{unavailabilityCount}</span>
                  <span className="text-base font-medium text-slate-400 ml-2 mt-2 self-center">day{unavailabilityCount !== 1 ? 's' : ''}</span>
                </div>
                {nextUnavailability && (
                  <div className="mt-auto pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <HugeiconsIcon icon={TimeScheduleIcon} className="size-3.5 text-orange-400 shrink-0" />
                      <span className="font-medium">Next:</span>
                      <span>{nextDateFormatted}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 ml-5">{nextTime}</div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 py-3 px-5">
                  <div className="flex justify-between items-center">
                    <div className="text-xs font-medium text-slate-500">Referred to Me</div>
                    <HugeiconsIcon icon={UserGroupIcon} className="size-4 text-violet-400" />
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-slate-900">{incomingReferrals}</span>
                    <span className="text-xs text-slate-400">patient{incomingReferrals !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 py-3 px-5">
                  <div className="flex justify-between items-center">
                    <div className="text-xs font-medium text-slate-500">Referrals to Others</div>
                    <HugeiconsIcon icon={Share08Icon} className="size-4 text-blue-400" />
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold text-slate-900">{outgoingReferrals}</span>
                    <span className="text-xs text-slate-400">patient{outgoingReferrals !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
              </>
              )}
            </div>
            </div>
        </div>
      </div>

      {/* Today's schedule */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon icon={TimeScheduleIcon} className="size-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Today's Schedule</h3>
          <div className="ml-auto flex items-center gap-2">
            {todayConflicts.length > 0 && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                {todayConflicts.length} conflict{todayConflicts.length !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => navigate('/dashboard/today-appointments')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
            >
              View All
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" />
            </button>
          </div>
        </div>
        <Card padding="none">
            {loading ? (
              <div className="p-5 space-y-2.5">
                {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-md animate-pulse" />)}
              </div>
            ) : todayAppts.length === 0 ? (
              <EmptyState
                icon={Calendar01Icon}
                title="No appointments today"
                description="You have no appointments scheduled for today."
              />
            ) : (
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <tbody>
                  {todayAppts
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map(a => {
                      const effective = getEffectiveStatus(a);
                      const isAttended = effective === 'attended';
                      const isMissed = effective === 'missed';
                      const isCancelled = effective === 'cancelled';
                      const isPending = effective === 'confirmed';
                      const borderColor = isAttended ? '#10b981' : isMissed ? '#9333ea' : isCancelled ? '#cbd5e1' : a.has_conflict ? '#ef4444' : '#f59e0b';
                      const isEditingLatness = latenessInput?.id === a.id;

                      const autoLatness = (() => {
                        const [h, m] = a.start_time.split(':').map(Number);
                        const slotStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
                        return Math.max(0, Math.floor((now.getTime() - slotStart.getTime()) / 60000));
                      })();

                      return (
                        <tr
                          key={a.id}
                          className={`cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0 ${a.has_conflict ? 'bg-red-50/30' : ''}`}
                          onClick={() => setSelectedAppointment(a)}
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
                          <td className="w-[100px] py-4 border-b border-slate-100 align-top"><StatusDot status={a.status} attended={a.attended} minutes_late={a.minutes_late} has_conflict={a.has_conflict} /></td>
                          <td className="pr-3 w-0 py-4 border-b border-slate-100 align-top">
                            {isEditingLatness ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-slate-500 whitespace-nowrap">Late:</span>
                                <input
                                  type="number"
                                  min={0}
                                  className="w-16 h-7 text-xs text-center border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                  value={latenessInput.minutes}
                                  onChange={e => setLatenessInput({ ...latenessInput, minutes: Math.max(0, parseInt(e.target.value) || 0) })}
                                  autoFocus
                                />
                                <span className="text-[11px] text-slate-500">min</span>
                                <button
                                  onClick={e => { e.stopPropagation(); handleConfirmAttend(a.id, true, latenessInput.minutes); }}
                                  className="p-1 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
                                  title="Confirm"
                                >
                                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                                </button>
                                <button
                                  onClick={() => setLatenessInput(null)}
                                  className="p-1 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                                  title="Cancel"
                                >
                                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={e => e.stopPropagation()}
                              >
                                {isPending && (
                                  <>
                                    <button
                                      onClick={e => { e.stopPropagation(); setLatenessInput({ id: a.id, minutes: autoLatness }); }}
                                      className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
                                      title="Mark attended"
                                    >
                                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                                    </button>
                                    <button
                                      onClick={() => handleConfirmAttend(a.id, false)}
                                      className="p-1.5 rounded-md text-red-400 hover:bg-red-50 transition-colors"
                                      title="Mark missed"
                                    >
                                      <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setSelectedAppointment(a)}
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
            )}
          </Card>
      </div>

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
