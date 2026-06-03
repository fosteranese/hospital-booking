import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { AppointmentDetailModal } from '@/components/AppointmentDetailModal';
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
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function StatusDot({ status, attended }: { status: string; attended: boolean | null }) {
  const map: Record<string, { label: string; color: string }> = {
    attended:  { label: 'Attended',  color: 'bg-emerald-500' },
    missed:    { label: 'Missed',    color: 'bg-red-500' },
    cancelled: { label: 'Cancelled', color: 'bg-slate-300' },
    confirmed: { label: 'Confirmed', color: 'bg-blue-500' },
  };
  const key = attended === true ? 'attended' : attended === false ? 'missed' : status === 'cancelled' ? 'cancelled' : 'confirmed';
  const s = map[key];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`size-1.5 rounded-full ${s.color}`} />
      {s.label}
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

function PendingSvg({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <circle cx="100" cy="100" r="55" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="100" cy="100" r="35" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <line x1="100" y1="100" x2="100" y2="50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
      <line x1="100" y1="100" x2="135" y2="115" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
      <circle cx="100" cy="100" r="4" fill="currentColor" opacity="0.25" />
      <circle cx="160" cy="40" r="6" fill="currentColor" opacity="0.15" />
      <circle cx="40" cy="165" r="4" fill="currentColor" opacity="0.12" />
      <circle cx="170" cy="155" r="3" fill="currentColor" opacity="0.1" />
      <circle cx="50" cy="45" r="2.5" fill="currentColor" opacity="0.08" />
    </svg>
  );
}

function AttendedSvg({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <path d="M55 100 L90 135 L150 65" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
      <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <circle cx="160" cy="50" r="5" fill="currentColor" opacity="0.18" />
      <circle cx="45" cy="55" r="3.5" fill="currentColor" opacity="0.12" />
      <circle cx="165" cy="150" r="4.5" fill="currentColor" opacity="0.15" />
      <circle cx="40" cy="155" r="6" fill="currentColor" opacity="0.1" />
      <circle cx="130" cy="30" r="2.5" fill="currentColor" opacity="0.08" />
      <circle cx="60" cy="175" r="3" fill="currentColor" opacity="0.1" />
    </svg>
  );
}

function MissedSvg({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="65" y1="65" x2="135" y2="135" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.2" />
      <line x1="135" y1="65" x2="65" y2="135" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" opacity="0.2" />
      <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <circle cx="50" cy="40" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="155" cy="155" r="5" fill="currentColor" opacity="0.12" />
      <circle cx="45" cy="135" r="3" fill="currentColor" opacity="0.1" />
      <circle cx="170" cy="60" r="2.5" fill="currentColor" opacity="0.08" />
      <circle cx="80" cy="175" r="4" fill="currentColor" opacity="0.1" />
    </svg>
  );
}

/* ── Row 1 stat card ── */

function TodayStatCard({
  label,
  value,
  icon,
  cardBg,
  borderClass,
  svgColor,
  svgBg,
}: {
  label: string;
  value: number;
  icon: any;
  cardBg: string;
  borderClass: string;
  svgColor: string;
  svgBg: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden h-full rounded-xl border ${cardBg} ${borderClass}`}>
      <div className={`absolute -bottom-4 -right-4 w-36 h-36 ${svgColor}`}>
        {svgBg}
      </div>
      <div className="relative h-full flex flex-col justify-between py-7 px-5">
        <div className="flex items-start justify-between">
          <div className="text-[38px] font-bold text-white tracking-tight leading-none">{value}</div>
          <div className="size-10 rounded-lg flex items-center justify-center shrink-0 bg-white/20">
            <HugeiconsIcon icon={icon} className="size-5 text-white" />
          </div>
        </div>
        <div className="text-sm text-white/70 font-medium mt-2 leading-snug">{label}</div>
      </div>
    </div>
  );
}

function FutureStatCard({
  label,
  value,
  icon,
  accentClass,
  borderClass,
}: {
  label: string;
  value: number;
  icon: any;
  accentClass: string;
  borderClass: string;
}) {
  return (
    <div className={`relative bg-white overflow-hidden rounded-xl border ${borderClass}`}>
      <div className="py-4 px-4">
        <div className="flex items-center gap-4">
          <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}>
            <HugeiconsIcon icon={icon} className="size-5 text-white" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">{label}</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{value}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DoctorDashboard() {
  const { token, user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

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

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const weekRange = getWeekRange(new Date());
  const now = new Date();
  const monthStart = today.slice(0, 7) + '-01';
  const monthEnd = today.slice(0, 7) + '-' + String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0');
  const yearStart = now.getFullYear() + '-01-01';
  const yearEnd = now.getFullYear() + '-12-31';

  const pendingToday = appointments.filter(a => a.slot_date === today && a.status === 'confirmed' && a.attended !== true).length;
  const attendedToday = appointments.filter(a => a.slot_date === today && a.attended === true).length;
  const missedToday = appointments.filter(a => a.slot_date === today && a.attended === false).length;
  const tomorrowTotal = appointments.filter(a => a.slot_date === tomorrow && a.status !== 'cancelled').length;
  const thisWeekTotal = appointments.filter(a => a.slot_date >= weekRange.start && a.slot_date <= weekRange.end && a.status !== 'cancelled').length;
  const thisMonthTotal = appointments.filter(a => a.slot_date >= monthStart && a.slot_date <= monthEnd && a.status !== 'cancelled').length;
  const thisYearTotal = appointments.filter(a => a.slot_date >= yearStart && a.slot_date <= yearEnd && a.status !== 'cancelled').length;

  const todayAppts = appointments.filter(a => a.slot_date === today);

  return (
    <div className="space-y-7">
      <PageHeader
        title={`Welcome, Dr. ${user?.first_name || 'Doctor'}`}
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        icon={Calendar01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3.5 py-2.5 rounded-lg">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Row 1: Today's stats — equal heights, tall cards with SVG illustrations */}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2 min-h-[148px]">
          {loading ? (
            <div className="h-full min-h-[148px] bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <TodayStatCard
              label="Pending Appointments Today"
              value={pendingToday}
              icon={TimeScheduleIcon}
              cardBg="bg-amber-500"
              borderClass="border-amber-700"
              svgColor="text-amber-200"
              svgBg={<PendingSvg />}
            />
          )}
        </div>
        <div className="min-h-[148px]">
          {loading ? (
            <div className="h-full min-h-[148px] bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <TodayStatCard
              label="Attended Today"
              value={attendedToday}
              icon={CheckmarkCircle01Icon}
              cardBg="bg-emerald-500"
              borderClass="border-emerald-700"
              svgColor="text-emerald-200"
              svgBg={<AttendedSvg />}
            />
          )}
        </div>
        <div className="min-h-[148px]">
          {loading ? (
            <div className="h-full min-h-[148px] bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <TodayStatCard
              label="Missed Today"
              value={missedToday}
              icon={Cancel01Icon}
              cardBg="bg-red-500"
              borderClass="border-red-700"
              svgColor="text-red-200"
              svgBg={<MissedSvg />}
            />
          )}
        </div>
      </div>

      {/* Row 2: Future appointments */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Future Appointments</h3>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {loading ? (
            <>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-[76px] bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </>
          ) : (
            <>
              <FutureStatCard label="Tomorrow" value={tomorrowTotal} icon={Calendar02Icon} accentClass="bg-sky-500" borderClass="border-sky-200" />
              <FutureStatCard label="This Week" value={thisWeekTotal} icon={Calendar01Icon} accentClass="bg-violet-500" borderClass="border-violet-200" />
              <FutureStatCard label="This Month" value={thisMonthTotal} icon={Calendar03Icon} accentClass="bg-teal-500" borderClass="border-teal-200" />
              <FutureStatCard label="This Year" value={thisYearTotal} icon={Calendar01Icon} accentClass="bg-indigo-500" borderClass="border-indigo-200" />
            </>
          )}
        </div>
      </div>

      {/* Today's schedule */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon icon={TimeScheduleIcon} className="size-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Today's Schedule</h3>
        </div>
        <Card padding="none">
          {loading ? (
            <div className="p-5 space-y-2.5">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-md animate-pulse" />)}
            </div>
          ) : todayAppts.length === 0 ? (
            <EmptyState
              icon={Calendar01Icon}
              title="No appointments today"
              description="You have no appointments scheduled for today."
            />
          ) : (
            <div className="divide-y divide-slate-50">
              {todayAppts
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map(a => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAppointmentId(a.id)}
                    className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50/80 group"
                  >
                    <div className="flex flex-col items-center w-14 shrink-0">
                      <span className="text-sm font-semibold text-slate-900">{formatTime(a.start_time)}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-100 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900">{a.patient_name || 'Patient'}</div>
                      {a.notes && <div className="text-xs text-slate-400 truncate mt-0.5">{a.notes}</div>}
                    </div>
                    <StatusDot status={a.status} attended={a.attended} />
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      {selectedAppointmentId && (
        <AppointmentDetailModal
          appointmentId={selectedAppointmentId}
          onClose={() => setSelectedAppointmentId(null)}
          onUpdated={() => fetchAppointments()}
        />
      )}
    </div>
  );
}
