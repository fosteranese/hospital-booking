import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem, Doctor } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Download01Icon, FilterIcon, AlertCircleIcon } from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function statusBadge(status: string, attended: boolean | null) {
  if (attended === true) return <Badge className="bg-green-500 hover:bg-green-500">Attended</Badge>;
  if (attended === false) return <Badge variant="destructive">Missed</Badge>;
  if (status === 'cancelled') return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
  return <Badge variant="secondary">Confirmed</Badge>;
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

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and export appointments</p>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <HugeiconsIcon icon={Download01Icon} className="size-4" />
          Export CSV
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={FilterIcon} className="size-4 text-primary" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Select value={doctorFilter} onValueChange={(v) => setDoctorFilter(v ?? '')}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All doctors</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? '')}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[180px]"
            />
            {(doctorFilter || statusFilter || dateFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setDoctorFilter(''); setStatusFilter(''); setDateFilter(''); }}>
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground animate-skeleton">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No appointments found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Specialization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.slot_date}</TableCell>
                    <TableCell>
                      {formatTime(a.start_time)} - {formatTime(a.end_time)}
                    </TableCell>
                    <TableCell className="font-medium">{a.doctor_name}</TableCell>
                    <TableCell className="text-muted-foreground">{a.specialization}</TableCell>
                    <TableCell>{statusBadge(a.status, a.attended)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{a.notes || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
