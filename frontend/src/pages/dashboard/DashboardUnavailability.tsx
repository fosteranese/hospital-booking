import { useState, useEffect, useCallback } from 'react';
import { api, Doctor, DoctorUnavailability } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, Add01Icon, Delete01Icon, AlertCircleIcon, Calendar01Icon } from '@hugeicons/core-free-icons';

export function DashboardUnavailability() {
  const { token, userRole } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [unavail, setUnavail] = useState<DoctorUnavailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // New unavailability form
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getDoctors().then(setDoctors).catch(() => {});
  }, []);

  const fetchUnavailability = useCallback(async () => {
    if (!selectedDoctorId) { setUnavail([]); return; }
    setLoading(true);
    setError('');
    try {
      const data = await api.getDoctorUnavailability(selectedDoctorId, token);
      setUnavail(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load unavailability');
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, token]);

  useEffect(() => { fetchUnavailability(); }, [fetchUnavailability]);

  const handleCreate = async () => {
    if (!selectedDoctorId || !newDate) return;
    setSaving(true);
    setError('');
    try {
      await api.createDoctorUnavailability(selectedDoctorId, {
        slot_date: newDate,
        start_time: newStart || undefined,
        end_time: newEnd || undefined,
        reason: newReason || undefined,
      }, token);
      setNewDate('');
      setNewStart('');
      setNewEnd('');
      setNewReason('');
      await fetchUnavailability();
    } catch (e: any) {
      setError(e.message || 'Failed to create unavailability');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (unavailId: string) => {
    if (!selectedDoctorId) return;
    try {
      await api.deleteDoctorUnavailability(selectedDoctorId, unavailId, token);
      setUnavail(prev => prev.filter(u => u.id !== unavailId));
    } catch (e: any) {
      setError(e.message || 'Failed to delete unavailability');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Doctor Unavailability</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage blackout periods for doctors</p>
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
            <HugeiconsIcon icon={Clock01Icon} className="size-4 text-primary" />
            Select Doctor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedDoctorId} onValueChange={(v) => setSelectedDoctorId(v ?? '')}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Choose a doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name} — {d.specialization}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedDoctorId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HugeiconsIcon icon={Add01Icon} className="size-4 text-primary" />
                Add Unavailability
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Date *</label>
                  <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-[180px]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Start time</label>
                  <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-[140px]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">End time</label>
                  <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-[140px]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Reason</label>
                  <Input type="text" value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="e.g. Annual leave" className="w-[200px]" />
                </div>
                <Button onClick={handleCreate} disabled={!newDate || saving}>
                  {saving ? 'Adding...' : 'Add'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Leave times empty for a full-day unavailability.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-primary" />
                Existing ({unavail.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-sm text-muted-foreground animate-skeleton">Loading...</div>
              ) : unavail.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground">No unavailability records for this doctor.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unavail.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.slot_date}</TableCell>
                        <TableCell>
                          {u.start_time && u.end_time
                            ? `${u.start_time.slice(0, 5)} - ${u.end_time.slice(0, 5)}`
                            : 'All day'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.reason || '—'}</TableCell>
                        <TableCell>
                          <Button size="icon-xs" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(u.id)}>
                            <HugeiconsIcon icon={Delete01Icon} className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
