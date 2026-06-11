import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem, Doctor } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useCachedData } from '@/hooks/useCachedData';
import { RefreshButton } from '@/components/RefreshButton';
import { ErrorAlert } from '@/components/ErrorAlert';

import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { AppointmentDetailModal } from '@/components/AppointmentDetailModal';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Download01Icon, FilterIcon, ArrowRight01Icon, UserGroupIcon } from '@hugeicons/core-free-icons';




import { formatTime, inputClass } from '@/lib/helpers';
import { StatusDot } from '@/components/StatusDot';
export function SchedulerDashboard() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [view, setView] = useState<'today' | 'all'>('today');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const cacheKey = `appointments:scheduler:${view}:${doctorFilter || ''}:${statusFilter || ''}:${dateFilter || ''}`;

  const { data: raw, loading, error, refresh: fetchAppointments, backgroundRefresh } = useCachedData(
    cacheKey,
    useCallback(async () => {
      if (view === 'today') {
        return await api.listAppointments({ date: today }, token);
      }
      const query: Record<string, string> = {};
      if (doctorFilter) query.doctor_id = doctorFilter;
      if (statusFilter) query.status = statusFilter;
      if (dateFilter) query.date = dateFilter;
      return await api.listAppointments(query, token);
    }, [token, view, doctorFilter, statusFilter, dateFilter, today]),
    { enabled: !!token }
  );
  const appointments = raw ?? [];

  const refreshAll = useCallback(() => {
    backgroundRefresh();
  }, [backgroundRefresh]);

  useEffect(() => {
    api.getDoctors().then(setDoctors).catch(() => {});
  }, []);

  const handleExport = () => {
    const query: Record<string, string> = {};
    if (doctorFilter) query.doctor_id = doctorFilter;
    if (statusFilter) query.status = statusFilter;
    if (dateFilter) query.date = dateFilter;
    api.downloadExportCsv(query, token);
  };

  const hasFilters = doctorFilter || statusFilter || dateFilter;
  const clearFilters = () => { setDoctorFilter(''); setStatusFilter(''); setDateFilter(''); };

  return (
    <div className="space-y-5">
      <PageHeader
        title={view === 'today' ? 'Today\'s Appointments' : 'All Appointments'}
        description={view === 'today'
          ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
          : 'Manage and export appointments'}
        icon={Calendar01Icon}
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={refreshAll} size="sm" />
            <div className="flex rounded-lg border border-border overflow-hidden bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <button
                onClick={() => setView('today')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'today' ? 'bg-emerald-600 dark:bg-emerald-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Today
              </button>
              <button
                onClick={() => setView('all')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'all' ? 'bg-emerald-600 dark:bg-emerald-500 text-white' : 'text-muted-foreground hover:bg-muted'}`}
              >
                All
              </button>
            </div>
            {view === 'all' && (
              <Button variant="secondary" size="sm" onClick={handleExport} icon={Download01Icon}>
                Export
              </Button>
            )}
          </div>
        }
      />

      {error && <ErrorAlert message={error} variant="compact" />}

      {view === 'all' && (
        <div className="flex flex-wrap items-center gap-2 bg-card rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)] px-3.5 py-2">
          <HugeiconsIcon icon={FilterIcon} className="size-3.5 text-muted-foreground" />
          <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className={`${inputClass} w-[170px]`}>
            <option value="">All doctors</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${inputClass} w-[130px]`}>
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className={`${inputClass} w-[150px]`} />
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1">
              Clear
            </button>
          )}
        </div>
      )}

      <Card padding="none">
        {loading ? (
          <div className="p-5 space-y-2.5">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-muted rounded-md animate-pulse" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={Calendar01Icon}
            title="No appointments found"
            description={view === 'today' ? 'There are no appointments scheduled for today.' : 'Try adjusting your filters.'}
          />
        ) : (
          <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Date</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Time</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Doctor</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Notes</th>
                  <th className="w-8 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id} onClick={() => setSelectedAppointmentId(a.id)} className="group cursor-pointer transition-all duration-150 hover:bg-muted/80 hover:scale-[1.02] hover:shadow-md border-b border-slate-50 last:border-0" style={{ transformOrigin: 'center' }}>
                    <td className="px-4 py-3 text-sm text-foreground">{a.slot_date}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatTime(a.start_time)} – {formatTime(a.end_time)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                          {a.doctor_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-sm text-foreground">{a.doctor_name}</span>
                        {a.referring_doctor_id && (
                          <span title={a.referring_doctor_name ? `Referred by Dr. ${a.referring_doctor_name}` : 'Referred by another doctor'}>
                            <HugeiconsIcon icon={UserGroupIcon} className="size-3 text-violet-500 shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusDot status={a.status} attended={a.attended} slot_date={a.slot_date} has_conflict={a.has_conflict} /></td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[160px] truncate">{a.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedAppointmentId && (
        <AppointmentDetailModal
          appointmentId={selectedAppointmentId}
          onClose={() => setSelectedAppointmentId(null)}
          onUpdated={() => refreshAll()}
        />
      )}
    </div>
  );
}
