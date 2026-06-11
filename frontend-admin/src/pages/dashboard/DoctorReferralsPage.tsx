import { useState, useEffect, useCallback } from 'react';
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
    arrival_time: r.arrival_time,
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

  const { data: referrals, loading, error, refresh: fetchReferrals, backgroundRefresh } = useCachedData(
    'referrals',
    useCallback(() => api.getReferrals(token), [token]),
    { enabled: !!token }
  );

  const refreshAll = useCallback(() => {
    backgroundRefresh();
  }, [backgroundRefresh]);

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
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Referrals"
          description="Appointments referred by doctors to other practitioners"
          icon={ArrowRight01Icon}
        />
        <div className="flex items-center gap-2 shrink-0 self-start pt-1">
          <button onClick={refreshAll} className="w-12 h-12 flex items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all" title="Refresh data">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5 text-slate-500">
              <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
          </button>
        </div>
      </div>

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
          <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <tbody>
                {referrals.map((r) => {
                  const status = getStatusLabel(r);
                  const borderColor = status.color.includes('emerald') ? '#10b981' : status.color.includes('purple') ? '#9333ea' : status.color.includes('amber') ? '#f59e0b' : '#cbd5e1';
                  return (
                    <tr key={r.id}
                      className="block sm:table-row relative cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md mb-2 sm:mb-0 rounded-lg sm:rounded-none overflow-hidden sm:overflow-visible border sm:border-0 border-slate-100 sm:border-none last:[&>td]:border-b-0"
                      onClick={() => setSelectedAppointment(referralToAppointment(r))}
                      style={{ transformOrigin: 'center' }}
                    >
                      {/* Full-height accent bar on mobile */}
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg sm:hidden" style={{ backgroundColor: borderColor }} />
                      <td className="block sm:table-cell pt-3 sm:py-4 pb-1 sm:py-4 border-b sm:border-b-slate-100 align-top px-3 sm:px-5 sm:border-l-[3px]" data-label="" style={{ borderLeftColor: borderColor }}>
                        <div className="text-sm font-semibold text-slate-900">{r.patient_name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{formatDate(r.slot_date)} · {formatTime(r.start_time)} — {formatTime(r.end_time)}</div>
                      </td>
                      <td className="block sm:table-cell py-1 sm:py-4 border-b sm:border-b-slate-100 align-top px-3 sm:px-5" data-label="Referred by">
                        <span className="sm:hidden text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5">Referred by</span>
                        <div className="text-sm font-medium text-slate-900">{r.referring_doctor_name}</div>
                      </td>
                      <td className="block sm:table-cell py-1 sm:py-4 border-b sm:border-b-slate-100 align-top px-3 sm:px-5" data-label="To">
                        <span className="sm:hidden text-[10px] font-medium text-slate-400 uppercase tracking-wider block mb-0.5">To</span>
                        <div className="text-sm font-medium text-slate-900">{r.doctor_name}</div>
                      </td>
                      <td className="block sm:table-cell py-2 sm:py-4 border-b-0 sm:border-b-slate-100 align-top px-3 sm:px-5" data-label="">
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
