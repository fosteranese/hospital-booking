import { useState, useEffect, useCallback } from 'react';
import { api, DashboardStats, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  DashboardSquare01Icon,
  Calendar01Icon,
  Cancel01Icon,
  CalendarAdd01Icon,
  Calendar02Icon,
  Calendar03Icon,
  ChartHistogramIcon,
  Clock01Icon,
  AlertCircleIcon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function DoctorDashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [pendingAppts, setPendingAppts] = useState<AppointmentHistoryItem[]>([]);
  const [missedAppts, setMissedAppts] = useState<AppointmentHistoryItem[]>([]);
  const [apptsLoading, setApptsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await api.getDashboardStats(token);
      setStats(data);
    } catch (e: any) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setStatsLoading(false);
    }
  }, [token]);

  const fetchTodayAppointments = useCallback(async () => {
    setApptsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await api.listAppointments({ date: today }, token);
      
      const pending = data.filter(a => a.attended === null && a.status !== 'cancelled');
      const missed = data.filter(a => a.attended === false);
      
      setPendingAppts(pending);
      setMissedAppts(missed);
    } catch (e: any) {
      console.error('Failed to fetch appointments:', e);
    } finally {
      setApptsLoading(false);
    }
  }, [token]);

  useEffect(() => { 
    fetchStats();
    fetchTodayAppointments();
  }, [fetchStats, fetchTodayAppointments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        icon={DashboardSquare01Icon}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Today</p>
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-slate-900">{stats?.today_appointments ?? 0}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">appointments</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl">
              <HugeiconsIcon icon={Calendar01Icon} className="size-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Missed Today</p>
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-red-600">{stats?.missed_today ?? 0}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">appointments</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl">
              <HugeiconsIcon icon={Cancel01Icon} className="size-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Tomorrow</p>
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-slate-900">{stats?.tomorrow_appointments ?? 0}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">appointments</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-xl">
              <HugeiconsIcon icon={CalendarAdd01Icon} className="size-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">This Week</p>
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-slate-900">{stats?.this_week_appointments ?? 0}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">appointments</p>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl">
              <HugeiconsIcon icon={Calendar02Icon} className="size-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">This Month</p>
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-slate-900">{stats?.this_month_appointments ?? 0}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">appointments</p>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl">
              <HugeiconsIcon icon={Calendar03Icon} className="size-6 text-amber-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Total</p>
              {statsLoading ? (
                <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-slate-900">{stats?.total_appointments ?? 0}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">appointments</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <HugeiconsIcon icon={ChartHistogramIcon} className="size-6 text-slate-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Today's Appointments Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Appointments */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Clock01Icon} className="size-5 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">Pending Today</h3>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {pendingAppts.length}
              </span>
            </div>
          </div>
          <div className="p-5">
            {apptsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : pendingAppts.length === 0 ? (
              <EmptyState
                icon={Clock01Icon}
                title="No pending appointments"
                description="All appointments have been attended or missed."
              />
            ) : (
              <div className="space-y-3">
                {pendingAppts.map((appt) => (
                  <div
                    key={appt.id}
                    className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">{appt.doctor_name}</p>
                        {appt.notes && (
                          <p className="text-xs text-slate-500 truncate">{appt.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Pending
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Missed Appointments */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-5 text-red-600" />
                <h3 className="text-base font-semibold text-slate-900">Missed Today</h3>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {missedAppts.length}
              </span>
            </div>
          </div>
          <div className="p-5">
            {apptsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : missedAppts.length === 0 ? (
              <EmptyState
                icon={AlertCircleIcon}
                title="No missed appointments"
                description="Great job! All appointments have been attended."
              />
            ) : (
              <div className="space-y-3">
                {missedAppts.map((appt) => (
                  <div
                    key={appt.id}
                    className="p-4 border border-red-200 rounded-lg bg-red-50/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-1">{appt.doctor_name}</p>
                        {appt.notes && (
                          <p className="text-xs text-slate-500 truncate">{appt.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Missed
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
