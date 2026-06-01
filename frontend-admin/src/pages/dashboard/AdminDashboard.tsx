import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem, Doctor } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { AppointmentDetailModal } from '@/components/AppointmentDetailModal';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar01Icon,
  Download01Icon,
  FilterIcon,
  AlertCircleIcon,
  Calendar02Icon,
  Cancel01Icon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status, attended }: { status: string; attended: boolean | null }) {
  if (attended === true) return <Badge variant="success">Attended</Badge>;
  if (attended === false) return <Badge variant="danger">Missed</Badge>;
  if (status === 'cancelled') return <Badge variant="neutral">Cancelled</Badge>;
  return <Badge variant="info">Confirmed</Badge>;
}

export function AdminDashboard() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query: Record<string, string> = {};
      if (doctorFilter) query.doctor_id = doctorFilter;
      if (statusFilter) query.status = statusFilter;
      if (dateFilter) query.date = dateFilter;
      const data = await api.listAppointments(query as any, token);
      setAppointments(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [token, doctorFilter, statusFilter, dateFilter]);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="View and manage all clinic appointments"
        icon={Calendar01Icon}
        actions={
          <Button variant="secondary" onClick={handleExport} icon={Download01Icon}>
            Export CSV
          </Button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <HugeiconsIcon icon={FilterIcon} className="size-4" />
            <span className="font-medium">Filter:</span>
          </div>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          >
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          >
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          {hasFilters && (
            <button
              onClick={() => { setDoctorFilter(''); setStatusFilter(''); setDateFilter(''); }}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={Calendar02Icon}
            title="No appointments found"
            description={hasFilters ? 'Try adjusting your filters to see more results.' : 'Appointments will appear here once patients book them.'}
            action={hasFilters ? (
              <Button variant="secondary" size="sm" onClick={() => { setDoctorFilter(''); setStatusFilter(''); setDateFilter(''); }}>
                Clear filters
              </Button>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Time</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Doctor</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Specialization</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Notes</th>
                  <th className="w-10 px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {appointments.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedAppointmentId(a.id)}
                    className="group cursor-pointer hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm text-slate-900 font-medium">{formatDate(a.slot_date)}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">
                      {formatTime(a.start_time)} – {formatTime(a.end_time)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                          {a.doctor_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{a.doctor_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{a.specialization}</td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={a.status} attended={a.attended} />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 max-w-[180px] truncate">{a.notes || '—'}</td>
                    <td className="px-5 py-3.5">
                      <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
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
