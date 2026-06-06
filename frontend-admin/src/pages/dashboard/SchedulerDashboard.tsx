import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem, Doctor } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { AppointmentDetailModal } from '@/components/AppointmentDetailModal';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, AlertCircleIcon, Download01Icon, FilterIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function StatusDot({ status, attended, has_conflict }: { status: string; attended: boolean | null; has_conflict?: boolean }) {
  if (has_conflict) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium">
        <span className="size-1.5 rounded-full bg-red-600" />
        Conflict
      </span>
    );
  }
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

const inputClass = "h-8 px-2.5 text-xs border border-slate-200 rounded-md bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none";

export function SchedulerDashboard() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'today' | 'all'>('today');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query: Record<string, string> = {};
      if (view === 'today') {
        query.date = today;
      } else {
        if (doctorFilter) query.doctor_id = doctorFilter;
        if (statusFilter) query.status = statusFilter;
        if (dateFilter) query.date = dateFilter;
      }
      const data = await api.listAppointments(query as any, token);
      setAppointments(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [token, view, doctorFilter, statusFilter, dateFilter, today]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  useEffect(() => {
    api.getDoctors().then(setDoctors).catch(() => {});
  }, []);

  const handleExport = () => {
    const query: Record<string, string> = {};
    if (doctorFilter) query.doctor_id = doctorFilter;
    if (statusFilter) query.status = statusFilter;
    if (dateFilter) query.date = dateFilter;
    api.downloadExportCsv(query as any, token);
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
            <div className="flex rounded-lg border border-slate-200 overflow-hidden bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <button
                onClick={() => setView('today')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'today' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Today
              </button>
              <button
                onClick={() => setView('all')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'all' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
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

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3.5 py-2.5 rounded-lg">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {view === 'all' && (
        <div className="flex flex-wrap items-center gap-2 bg-white rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)] px-3.5 py-2">
          <HugeiconsIcon icon={FilterIcon} className="size-3.5 text-slate-400" />
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
            <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-600 transition-colors ml-1">
              Clear
            </button>
          )}
        </div>
      )}

      <Card padding="none">
        {loading ? (
          <div className="p-5 space-y-2.5">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-10 bg-slate-100 rounded-md animate-pulse" />
            ))}
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={Calendar01Icon}
            title="No appointments found"
            description={view === 'today' ? 'There are no appointments scheduled for today.' : 'Try adjusting your filters.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5">Date</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5">Time</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5">Doctor</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5">Status</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 py-2.5">Notes</th>
                  <th className="w-8 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a.id} onClick={() => setSelectedAppointmentId(a.id)} className="group cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md border-b border-slate-50 last:border-0" style={{ transformOrigin: 'center' }}>
                    <td className="px-4 py-3 text-sm text-slate-900">{a.slot_date}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatTime(a.start_time)} – {formatTime(a.end_time)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
                          {a.doctor_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-sm text-slate-900">{a.doctor_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusDot status={a.status} attended={a.attended} has_conflict={a.has_conflict} /></td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[160px] truncate">{a.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
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
          onUpdated={() => fetchAppointments()}
        />
      )}
    </div>
  );
}
