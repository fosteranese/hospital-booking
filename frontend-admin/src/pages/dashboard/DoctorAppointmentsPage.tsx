import { useState, useEffect } from 'react';
import { api, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar01Icon,
  AlertCircleIcon,
  Clock01Icon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function StatusBadge({ status, attended }: { status: string; attended: boolean | null }) {
  if (attended === true) return <Badge variant="success">Attended</Badge>;
  if (attended === false) return <Badge variant="danger">Missed</Badge>;
  if (status === 'cancelled') return <Badge variant="neutral">Cancelled</Badge>;
  return <Badge variant="info">Confirmed</Badge>;
}

export function DoctorAppointmentsPage() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUpcomingAppointments();
  }, [token]);

  const fetchUpcomingAppointments = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listAppointments({}, token);
      const today = new Date().toISOString().split('T')[0];
      const upcoming = data.filter(a => a.slot_date >= today && a.status !== 'cancelled');
      upcoming.sort((a, b) => {
        if (a.slot_date !== b.slot_date) return a.slot_date.localeCompare(b.slot_date);
        return a.start_time.localeCompare(b.start_time);
      });
      setAppointments(upcoming);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const groupedByDate = appointments.reduce((acc, appt) => {
    if (!acc[appt.slot_date]) {
      acc[appt.slot_date] = [];
    }
    acc[appt.slot_date].push(appt);
    return acc;
  }, {} as Record<string, AppointmentHistoryItem[]>);

  const sortedDates = Object.keys(groupedByDate).sort();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upcoming Appointments"
        description={`${appointments.length} upcoming appointment${appointments.length !== 1 ? 's' : ''}`}
        icon={Calendar01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <Card padding="none">
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </Card>
      ) : appointments.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={Calendar01Icon}
            title="No upcoming appointments"
            description="You have no scheduled appointments at this time."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((date) => (
            <Card key={date} padding="none">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Clock01Icon} className="size-4 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDate(date)}
                  </p>
                  <Badge variant="neutral">{groupedByDate[date].length}</Badge>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {groupedByDate[date].map((appt) => (
                  <div key={appt.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
                          </span>
                          <StatusBadge status={appt.status} attended={appt.attended} />
                        </div>
                        <p className="text-sm text-slate-600">{appt.doctor_name}</p>
                        {appt.notes && (
                          <p className="text-sm text-slate-500 mt-1 truncate">{appt.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
