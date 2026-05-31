import { useState, useEffect, useCallback } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, Clock01Icon, AlertCircleIcon, CheckmarkCircle02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function statusBadge(status: string, attended: boolean | null) {
  if (attended === true) return <Badge variant="default" className="bg-green-500 hover:bg-green-500">Attended</Badge>;
  if (attended === false) return <Badge variant="destructive">Missed</Badge>;
  if (status === 'cancelled') return <Badge variant="outline" className="text-muted-foreground">Cancelled</Badge>;
  return <Badge variant="secondary">Confirmed</Badge>;
}

export function DoctorDashboard() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAppointments({ date: today }, token);
      setAppointments(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [token, today]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const handleAttendance = async (id: string, attended: boolean) => {
    try {
      await api.markAttendance(id, { attended }, token);
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, attended, status: 'confirmed' } : a));
    } catch (e: any) {
      setError(e.message || 'Failed to update attendance');
    }
  };

  const confirmed = appointments.filter(a => a.status !== 'cancelled');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Today's Appointments</h1>
        <p className="text-sm text-muted-foreground mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
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
            <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-primary" />
            Scheduled ({confirmed.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground animate-skeleton">Loading appointments...</div>
          ) : confirmed.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No appointments scheduled for today.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {confirmed.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={Clock01Icon} className="size-3.5 text-muted-foreground" />
                        {formatTime(a.start_time)} - {formatTime(a.end_time)}
                      </div>
                    </TableCell>
                    <TableCell>{a.doctor_name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{a.notes || '—'}</TableCell>
                    <TableCell>{statusBadge(a.status, a.attended)}</TableCell>
                    <TableCell className="text-right">
                      {a.attended === null && a.status !== 'cancelled' && (
                        <div className="flex items-center justify-end gap-1">
                          <Button size="xs" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleAttendance(a.id, true)}>
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                            Attended
                          </Button>
                          <Button size="xs" variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => handleAttendance(a.id, false)}>
                            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                            Missed
                          </Button>
                        </div>
                      )}
                    </TableCell>
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
