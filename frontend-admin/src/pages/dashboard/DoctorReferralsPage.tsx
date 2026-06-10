import { useState, useEffect } from 'react';
import { api, ReferralItem, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useCachedData } from '@/hooks/useCachedData';
import { useContentContainer } from '@/pages/dashboard/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { AppointmentSlidePanel } from '@/components/AppointmentSlidePanel';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon, AlertCircleIcon, Calendar01Icon, CheckmarkCircle01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusLabel(a: ReferralItem): { label: string; color: string } {
  if (a.status === 'cancelled') return { label: 'Cancelled', color: 'bg-slate-300' };
  if (a.attended === true) return { label: 'Attended', color: 'bg-emerald-500' };
  if (a.attended === false) return { label: 'Missed', color: 'bg-purple-500' };
  return { label: 'Confirmed', color: 'bg-amber-400' };
}

function referralToAppointment(r: ReferralItem): AppointmentHistoryItem {
  return {
    id: r.id,
    patient_id: '',
    patient_name: r.patient_name,
    patient_email: r.patient_email,
    patient_phone: null,
    doctor_id: r.doctor_id,
    doctor_name: r.doctor_name,
    specialization: '',
    slot_date: r.slot_date,
    start_time: r.start_time,
    end_time: r.end_time,
    status: r.status,
    notes: r.notes,
    attended: r.attended,
    minutes_late: null,
    cancellation_reason: r.cancellation_reason,
    has_conflict: false,
    referring_doctor_id: r.referring_doctor_id,
    referring_doctor_name: r.referring_doctor_name,
  };
}

export function DoctorReferralsPage() {
  const { token } = useAuth();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentHistoryItem | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentHistoryItem | null>(null);

  const { data: referrals, loading, error } = useCachedData(
    'referrals',
    () => api.getReferrals(token),
    { enabled: !!token }
  );

  const { setContainerClass } = useContentContainer();
  const panelOpen = !!selectedAppointment;

  useEffect(() => {
    setContainerClass(panelOpen
      ? 'max-w-[2000px] lg:max-w-[calc(80rem+480px)] mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200'
      : 'max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
    return () => setContainerClass('max-w-7xl mx-auto p-6 lg:p-8 space-y-5 transition-all duration-200');
  }, [panelOpen, setContainerClass]);

  return (
    <div className={`space-y-6 transition-[margin-right] duration-200 ${panelOpen ? 'lg:mr-[480px]' : ''}`}>
      <PageHeader
        title="Referrals"
        description="Appointments referred by doctors to other practitioners"
        icon={ArrowRight01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : !referrals || referrals.length === 0 ? (
          <EmptyState
            icon={CheckmarkCircle01Icon}
            title="No referrals"
            description="No doctor referrals have been made yet."
          />
        ) : (
          <div>
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                {referrals.map((r) => {
                  const status = getStatusLabel(r);
                  return (
                    <tr key={r.id}
                      className="cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md group last:[&>td]:border-b-0 transform-gpu"
                      style={{ transformOrigin: 'center' }}
                      onClick={() => setSelectedAppointment(referralToAppointment(r))}
                    >
                      <td className="py-4 border-b border-slate-100 align-top px-5 whitespace-nowrap" style={{ borderLeft: `3px solid ${status.color.includes('emerald') ? '#10b981' : status.color.includes('purple') ? '#9333ea' : status.color.includes('amber') ? '#f59e0b' : '#cbd5e1'}` }}>
                        <div className="text-sm font-semibold text-slate-900">{r.patient_name}</div>
                        <div className="text-xs text-slate-400">{formatDate(r.slot_date)} · {formatTime(r.start_time)} — {formatTime(r.end_time)}</div>
                      </td>
                      <td className="py-4 border-b border-slate-100 align-top px-5">
                        <div className="text-sm text-slate-500">
                          <span className="text-xs text-slate-400 uppercase tracking-wider">Referred by</span>
                          <div className="text-sm font-medium text-slate-900">{r.referring_doctor_name}</div>
                        </div>
                      </td>
                      <td className="py-4 border-b border-slate-100 align-top px-5">
                        <div className="text-sm text-slate-500">
                          <span className="text-xs text-slate-400 uppercase tracking-wider">To</span>
                          <div className="text-sm font-medium text-slate-900">{r.doctor_name}</div>
                        </div>
                      </td>
                      <td className="py-4 border-b border-slate-100 align-top px-5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                          status.color === 'bg-emerald-500' ? 'text-emerald-700 bg-emerald-50' :
                          status.color === 'bg-purple-500' ? 'text-purple-700 bg-purple-50' :
                          status.color === 'bg-amber-400' ? 'text-amber-700 bg-amber-50' :
                          'text-slate-400 bg-slate-50'
                        }`}>
                          <span className={`size-1.5 rounded-full ${status.color}`} />
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedAppointment && (
        <AppointmentSlidePanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onRequestAttendance={() => {}}
          onReschedule={setRescheduleTarget}
        />
      )}
    </div>
  );
}
