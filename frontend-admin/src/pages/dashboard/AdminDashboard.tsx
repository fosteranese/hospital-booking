import { useState, useEffect, useCallback } from 'react';
import { api, Doctor, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useCachedData } from '@/hooks/useCachedData';
import { RefreshButton } from '@/components/RefreshButton';
import { ErrorAlert } from '@/components/ErrorAlert';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { DataTable } from '@/components/DataTable';
import { AppointmentDetailModal } from '@/components/AppointmentDetailModal';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar01Icon,
  Download01Icon,
  FilterIcon,
  ArrowRight01Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { formatTime, selectClass } from '@/lib/helpers';
import { StatusDot } from '@/components/StatusDot';
export function AdminDashboard() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const cacheKey = `appointments:admin:${doctorFilter || ''}:${statusFilter || ''}:${dateFilter || ''}`;

  const { data: raw, loading, error, refresh: fetchAppointments, backgroundRefresh } = useCachedData(
    cacheKey,
    useCallback(async () => {
      const query: Record<string, string> = {};
      if (doctorFilter) query.doctor_id = doctorFilter;
      if (statusFilter) query.status = statusFilter;
      if (dateFilter) query.date = dateFilter;
      return await api.listAppointments(query, token);
    }, [token, doctorFilter, statusFilter, dateFilter]),
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
        title="Appointments"
        description="View and manage all clinic appointments"
        icon={Calendar01Icon}
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={refreshAll} size="sm" />
            <Button variant="secondary" onClick={handleExport} icon={Download01Icon} size="sm">
              Export CSV
            </Button>
          </div>
        }
      />

      {error && <ErrorAlert message={error} variant="compact" />}

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-card rounded-lg shadow-[0_1px_3px_0_rgb(0,0,0,0.06),0_1px_2px_-1px_rgb(0,0,0,0.04)] px-3.5 py-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={FilterIcon} className="size-3.5" />
        </div>
        <select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)} className={`${selectClass} w-[170px]`}>
          <option value="">All doctors</option>
          {doctors.map(d => (
            <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={`${selectClass} w-[130px]`}>
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="h-8 px-2.5 text-xs border border-border rounded-md bg-card text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-[150px]"
        />
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <Card padding="none">
        <DataTable<AppointmentHistoryItem>
          columns={[
            { key: 'date', header: 'Date', render: (a) => <span className="text-sm text-foreground">{a.slot_date}</span> },
            { key: 'time', header: 'Time', render: (a) => <span className="text-sm text-muted-foreground">{formatTime(a.start_time)} – {formatTime(a.end_time)}</span> },
            {
              key: 'doctor', header: 'Doctor', render: (a) => (
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
              ),
            },
            { key: 'status', header: 'Status', render: (a) => <StatusDot status={a.status} attended={a.attended} slot_date={a.slot_date} has_conflict={a.has_conflict} /> },
            { key: 'notes', header: 'Notes', render: (a) => <span className="text-sm text-muted-foreground max-w-[160px] truncate block">{a.notes || '—'}</span> },
            { key: 'arrow', header: '', className: 'w-8', render: () => <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" /> },
          ]}
          data={appointments}
          loading={loading}
          emptyMessage="No appointments found"
          emptyIcon={Calendar01Icon}
          emptyAction={hasFilters ? <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button> : undefined}
          onRowClick={(a) => setSelectedAppointmentId(a.id)}
          keyExtractor={(a) => a.id}
          skeletonRows={5}
        />
      </Card>

      {selectedAppointmentId && (
        <AppointmentDetailModal
          appointmentId={selectedAppointmentId}
          onClose={() => setSelectedAppointmentId(null)}
          onUpdated={refreshAll}
        />
      )}
    </div>
  );
}
