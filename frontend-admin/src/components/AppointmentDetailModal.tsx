import { useState, useEffect } from 'react';
import { api, AppointmentDetail as AppointmentDetailType, Doctor, DoctorSchedule } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, AlertCircleIcon, UserGroupIcon, Loading02Icon } from '@hugeicons/core-free-icons';

interface Props {
  appointmentId: string;
  onClose: () => void;
  onUpdated: () => void;
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function AppointmentDetailModal({ appointmentId, onClose, onUpdated }: Props) {
  const { token, userRole } = useAuth();
  const [appt, setAppt] = useState<AppointmentDetailType | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState<'view' | 'cancel' | 'change-doctor'>('view');
  const [cancelReason, setCancelReason] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAppointment = async () => {
    setLoading(true);
    try {
      const data = await api.getAppointment(appointmentId, token);
      setAppt(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointment();
    api.getDoctors().then(setDoctors).catch(() => {});
  }, [appointmentId]);

  const handleCancel = async () => {
    setSaving(true);
    setError('');
    try {
      await api.cancelAppointment(appointmentId, { cancellation_reason: cancelReason }, token);
      onUpdated();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangeDoctor = async () => {
    if (!selectedDoctorId) return;
    setSaving(true);
    setError('');
    try {
      await api.changeDoctor(appointmentId, { doctor_id: selectedDoctorId }, token);
      onUpdated();
      setAction('view');
      fetchAppointment();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl p-6 max-w-lg w-full shadow-xl ring-1 ring-foreground/10" onClick={e => e.stopPropagation()}>
        <div className="text-sm text-muted-foreground animate-skeleton">Loading...</div>
      </div>
    </div>
  );

  if (!appt && !loading) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl max-w-lg w-full shadow-xl ring-1 ring-foreground/10 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-lg font-bold text-foreground">Appointment Details</h2>
          <Button size="icon-sm" variant="ghost" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </Button>
        </div>

        {error && (
          <div className="mx-6 mb-4 flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2.5 rounded-lg">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="px-6 pb-6 space-y-4">
          {action === 'view' && (
            <>
              {appt!.referring_doctor_id && (
                <div className="flex items-center gap-2 p-3 bg-violet-50 rounded-lg border border-violet-100">
                  <HugeiconsIcon icon={UserGroupIcon} className="size-3.5 text-violet-500" />
                  <span className="text-xs text-violet-700">Referred by another doctor</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <p className="font-medium capitalize">{appt!.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Attended</p>
                  <p className="font-medium">{appt!.attended === null ? '—' : appt!.attended ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Patient ID</p>
                  <p className="font-medium text-xs font-mono">{appt!.patient_id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Doctor ID</p>
                  <p className="font-medium text-xs font-mono">{appt!.doctor_id}</p>
                </div>
                {appt!.cancellation_reason && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Cancellation Reason</p>
                    <p className="font-medium">{appt!.cancellation_reason}</p>
                  </div>
                )}
                {appt!.notes && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Notes</p>
                    <p className="font-medium">{appt!.notes}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Created</p>
                  <p className="font-medium">{new Date(appt!.created_at).toLocaleString()}</p>
                </div>
              </div>
              {appt!.status === 'confirmed' && (userRole === 'admin' || userRole === 'scheduler') && (
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setAction('cancel')}>Cancel</Button>
                  <Button variant="outline" size="sm" onClick={() => setAction('change-doctor')}>Change Doctor</Button>
                </div>
              )}
            </>
          )}

          {action === 'cancel' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Cancel Appointment</p>
              <Input
                placeholder="Reason for cancellation"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={handleCancel} disabled={saving}>
                  {saving ? <span className="flex items-center gap-2"><HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" /><span>Cancelling...</span></span> : 'Confirm Cancel'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAction('view')}>Back</Button>
              </div>
            </div>
          )}

          {action === 'change-doctor' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Change Doctor</p>
              <Select value={selectedDoctorId} onValueChange={(v) => setSelectedDoctorId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((d) => (
                    <SelectItem key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleChangeDoctor} disabled={!selectedDoctorId || saving}>
                  {saving ? <span className="flex items-center gap-2"><HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" /><span>Saving...</span></span> : 'Change Doctor'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAction('view')}>Back</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
