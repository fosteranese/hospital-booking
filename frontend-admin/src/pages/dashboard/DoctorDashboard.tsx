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
  ArrowUp01Icon,
  ArrowDown01Icon,
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

function TrendBadge({ value, label }: { value: number; label: string }) {
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
  const initial = (name || 'P').charAt(0).toUpperCase();
  return (
    <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 text-xs font-semibold text-slate-600">
      {initial}
    </div>
  );
}

function QuickActionsBar({ pendingCount, onMarkAttendance }: { pendingCount: number; onMarkAttendance: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onMarkAttendance}
        disabled={pendingCount === 0}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5" />
        Mark Attendance
      </button>
      <span className="text-[11px] text-slate-400">{pendingCount} pending</span>
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
  trend: number;
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

export function DoctorDashboard() {
  const { token, otpIdentifier } = useAuth();
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

  const handleMarkAttendance = useCallback(async (id: string, attended: boolean) => {
    try {
      await api.markAttendance(id, { attended }, token);
      fetchAppointments();
    } catch (e: any) {
      setError(e.message || 'Failed to update attendance');
    }
  }, [token, fetchAppointments]);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
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

  const pendingToday = appointments.filter(a => a.slot_date === today && a.status === 'confirmed' && a.attended !== true).length;
  const attendedToday = appointments.filter(a => a.slot_date === today && a.attended === true).length;
  const missedToday = appointments.filter(a => a.slot_date === today && a.attended === false).length;
  const totalToday = pendingToday + attendedToday + missedToday;

  const yesterdayPending = appointments.filter(a => a.slot_date === yesterday && a.status === 'confirmed' && a.attended !== true).length;
  const yesterdayAttended = appointments.filter(a => a.slot_date === yesterday && a.attended === true).length;
  const yesterdayMissed = appointments.filter(a => a.slot_date === yesterday && a.attended === false).length;
  const yesterdayTotal = yesterdayPending + yesterdayAttended + yesterdayMissed;

  const tomorrowTotal = appointments.filter(a => a.slot_date === tomorrow && a.status !== 'cancelled').length;
  const dayAfterTomorrow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const dayAfterTotal = appointments.filter(a => a.slot_date === dayAfterTomorrow && a.status !== 'cancelled').length;
  const tomorrowTrend = Math.max(dayAfterTotal, 1) > 0 ? Math.round(((tomorrowTotal - dayAfterTotal) / Math.max(dayAfterTotal, 1)) * 100) : 0;

  const thisWeekTotal = appointments.filter(a => a.slot_date >= weekRange.start && a.slot_date <= weekRange.end && a.status !== 'cancelled').length;
  const prevWeekTotal = appointments.filter(a => a.slot_date >= prevWeekStart && a.slot_date <= prevWeekEnd && a.status !== 'cancelled').length;
  const weekTrend = Math.max(prevWeekTotal, 1) > 0 ? Math.round(((thisWeekTotal - prevWeekTotal) / Math.max(prevWeekTotal, 1)) * 100) : 0;

  const thisMonthTotal = appointments.filter(a => a.slot_date >= monthStart && a.slot_date <= monthEnd && a.status !== 'cancelled').length;
  const prevMonthTotal = appointments.filter(a => a.slot_date >= prevMonthStart && a.slot_date <= prevMonthEnd && a.status !== 'cancelled').length;
  const monthTrend = Math.max(prevMonthTotal, 1) > 0 ? Math.round(((thisMonthTotal - prevMonthTotal) / Math.max(prevMonthTotal, 1)) * 100) : 0;

  const thisYearTotal = appointments.filter(a => a.slot_date >= yearStart && a.slot_date <= yearEnd && a.status !== 'cancelled').length;
  const prevYearTotal = appointments.filter(a => a.slot_date >= prevYearStart && a.slot_date <= prevYearEnd && a.status !== 'cancelled').length;
  const yearTrend = Math.max(prevYearTotal, 1) > 0 ? Math.round(((thisYearTotal - prevYearTotal) / Math.max(prevYearTotal, 1)) * 100) : 0;

  const todayAppts = appointments.filter(a => a.slot_date === today);

  return (
    <div className="space-y-7">
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

      {/* Quick actions */}
      {!loading && (
        <QuickActionsBar
          pendingCount={pendingToday}
          onMarkAttendance={() => {
            const firstPending = todayAppts.find(a => a.status === 'confirmed' && a.attended !== true);
            if (firstPending) setSelectedAppointmentId(firstPending.id);
          }}
        />
      )}

      {/* Row 1: Today's stats with mini donuts */}
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
              cardBg="bg-red-500"
              borderClass="border-red-700"
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

      {/* Row 2: Future appointments with trends */}
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
              <FutureStatCard label="Tomorrow" value={tomorrowTotal} trend={tomorrowTrend} icon={Calendar02Icon} accentClass="bg-sky-500" borderClass="border-sky-200" />
              <FutureStatCard label="This Week" value={thisWeekTotal} trend={weekTrend} icon={Calendar01Icon} accentClass="bg-violet-500" borderClass="border-violet-200" />
              <FutureStatCard label="This Month" value={thisMonthTotal} trend={monthTrend} icon={Calendar03Icon} accentClass="bg-teal-500" borderClass="border-teal-200" />
              <FutureStatCard label="This Year" value={thisYearTotal} trend={yearTrend} icon={Calendar01Icon} accentClass="bg-indigo-500" borderClass="border-indigo-200" />
            </>
          )}
        </div>
      </div>

      {/* Today's schedule with enhanced rows */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <HugeiconsIcon icon={TimeScheduleIcon} className="size-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Today's Schedule</h3>
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
            <div className="divide-y divide-slate-100">
              {todayAppts
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map(a => {
                  const isAttended = a.attended === true;
                  const isMissed = a.attended === false;
                  const isCancelled = a.status === 'cancelled';
                  const borderColor = isAttended ? '#10b981' : isMissed ? '#ef4444' : isCancelled ? '#cbd5e1' : '#f59e0b';
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 pl-4 pr-3 py-3 border-l-4 cursor-pointer transition-colors hover:bg-slate-50/80 group"
                      style={{ borderLeftColor: borderColor }}
                    >
                      <PatientAvatar name={a.patient_name} />
                      <div className="flex flex-col items-center w-14 shrink-0">
                        <span className="text-sm font-semibold text-slate-900">{formatTime(a.start_time)}</span>
                        <span className="text-[10px] text-slate-400">{formatTime(a.end_time)}</span>
                      </div>
                      <div className="w-px h-8 bg-slate-100 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900">{a.patient_name || 'Patient'}</div>
                        {a.notes && <div className="text-xs text-slate-400 truncate mt-0.5">{a.notes}</div>}
                      </div>
                      <StatusDot status={a.status} attended={a.attended} />
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isAttended && !isMissed && !isCancelled && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); handleMarkAttendance(a.id, true); }}
                              className="p-1.5 rounded-md text-emerald-500 hover:bg-emerald-50 transition-colors"
                              title="Mark attended"
                            >
                              <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleMarkAttendance(a.id, false); }}
                              className="p-1.5 rounded-md text-red-400 hover:bg-red-50 transition-colors"
                              title="Mark missed"
                            >
                              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedAppointmentId(a.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 transition-colors"
                        >
                          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
