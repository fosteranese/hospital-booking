import { useState, useEffect } from 'react';
import { api, AnalyticsOverview, DoctorStat } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ChartHistogramIcon,
  AlertCircleIcon,
  StethoscopeIcon,
  Calendar01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  UserMultiple02Icon,
  Clock01Icon,
  Time03Icon,
} from '@hugeicons/core-free-icons';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: any;
  color: 'emerald' | 'blue' | 'amber' | 'red' | 'slate' | 'purple';
}

const colorMap = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-100' },
};

function StatCard({ label, value, sublabel, icon, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm shadow-slate-100/50 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          {sublabel && <p className="text-xs text-slate-400 mt-0.5">{sublabel}</p>}
        </div>
        <div className={`size-10 rounded-xl ${c.bg} flex items-center justify-center ring-1 ${c.ring}`}>
          <HugeiconsIcon icon={icon} className={`size-5 ${c.text}`} />
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [doctorStats, setDoctorStats] = useState<DoctorStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [ov, stats] = await Promise.all([
          api.getAnalyticsOverview(token),
          api.getDoctorStats(token),
        ]);
        setOverview(ov);
        setDoctorStats(stats);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Clinic overview and statistics" icon={ChartHistogramIcon} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-5 h-28 animate-pulse">
              <div className="h-3 w-20 bg-slate-100 rounded mb-3" />
              <div className="h-7 w-12 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Clinic overview and performance metrics"
        icon={ChartHistogramIcon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Appointments" value={overview.total_appointments} icon={Calendar01Icon} color="blue" />
          <StatCard label="Confirmed" value={overview.confirmed} icon={CheckmarkCircle02Icon} color="emerald" />
          <StatCard label="Attended" value={overview.attended} icon={CheckmarkCircle02Icon} color="emerald" />
          <StatCard label="Missed" value={overview.missed} icon={Cancel01Icon} color="red" />
          <StatCard label="Cancelled" value={overview.cancelled} icon={Cancel01Icon} color="slate" />
          <StatCard label="Today" value={overview.today_total} sublabel={`${overview.today_confirmed} confirmed`} icon={Time03Icon} color="amber" />
          <StatCard label="Total Patients" value={overview.total_patients} icon={UserMultiple02Icon} color="purple" />
          <StatCard label="Total Doctors" value={overview.total_doctors} icon={StethoscopeIcon} color="blue" />
        </div>
      )}

      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100">
          <CardHeader title="Per-Doctor Statistics" description="Performance breakdown by doctor" />
        </div>
        {doctorStats.length === 0 ? (
          <EmptyState
            icon={StethoscopeIcon}
            title="No data available"
            description="Doctor statistics will appear here once appointments are tracked."
          />
        ) : (
          <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Doctor</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Specialization</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Total</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Attended</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Missed</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Cancelled</th>
                  <th className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Upcoming</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {doctorStats.map((d) => (
                  <tr key={d.doctor_id} className="transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md" style={{ transformOrigin: 'center' }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">
                          {d.doctor_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium text-slate-900">Dr. {d.doctor_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">{d.specialization}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-900 text-right font-medium">{d.total_appointments}</td>
                    <td className="px-5 py-3.5 text-sm text-emerald-600 text-right font-medium">{d.attended}</td>
                    <td className="px-5 py-3.5 text-sm text-purple-600 text-right font-medium">{d.missed}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-500 text-right">{d.cancelled}</td>
                    <td className="px-5 py-3.5 text-sm text-slate-900 text-right font-medium">{d.upcoming}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
