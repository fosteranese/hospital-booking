import { useState } from 'react';
import { api, Patient, AppointmentHistoryItem } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Search01Icon,
  AlertCircleIcon,
  Calendar01Icon,
  UserMultiple02Icon,
  Mail01Icon,
  CallIcon,
} from '@hugeicons/core-free-icons';

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

function StatusBadge({ status, attended }: { status: string; attended: boolean | null }) {
  if (attended === true) return <Badge variant="success">Attended</Badge>;
  if (attended === false) return <Badge variant="danger">Missed</Badge>;
  if (status === 'cancelled') return <Badge variant="neutral">Cancelled</Badge>;
  return <Badge variant="info">Confirmed</Badge>;
}

export function PatientSearchPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [history, setHistory] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setSelectedPatient(null);
    try {
      const data = await api.searchPatients(query.trim(), token);
      setResults(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectPatient = async (p: Patient) => {
    setSelectedPatient(p);
    setHistoryLoading(true);
    try {
      const [upcoming, past] = await Promise.all([
        api.getPatientUpcoming(p.id, token),
        api.getPatientHistory(p.id, token),
      ]);
      setHistory([...upcoming.map(a => ({ ...a, patient_id: '', patient_name: '', patient_email: '', patient_phone: null, attended: null, minutes_late: null, cancellation_reason: '', has_conflict: false })), ...past]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patient Search"
        description="Search patients by name, email, or phone"
        icon={UserMultiple02Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              placeholder="Search patients by name, email, or phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full h-10 pl-10 pr-4 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>
          <Button onClick={handleSearch} loading={loading} disabled={!query.trim()}>
            Search
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {results.length > 0 && (
          <Card padding="none" className="lg:col-span-1">
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Results ({results.length})</p>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPatient(p)}
                  className={`w-full text-left px-5 py-3.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors ${
                    selectedPatient?.id === p.id ? 'bg-emerald-50/50 border-l-2 border-l-emerald-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                      {p.first_name[0]}{p.last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.first_name} {p.last_name}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <HugeiconsIcon icon={Mail01Icon} className="size-3 shrink-0" />
                        <span className="truncate">{p.email}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {selectedPatient && (
          <Card padding="none" className="lg:col-span-2">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
                  {selectedPatient.first_name[0]}{selectedPatient.last_name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={Mail01Icon} className="size-3" />
                      {selectedPatient.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon icon={CallIcon} className="size-3" />
                      {selectedPatient.phone}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {historyLoading ? (
              <div className="p-8">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            ) : history.length === 0 ? (
              <EmptyState
                icon={Calendar01Icon}
                title="No appointments"
                description="This patient has no appointment history."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Time</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Doctor</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                      <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {history.map((a) => (
                      <tr key={a.id} className="cursor-pointer transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md" style={{ transformOrigin: 'center' }}>
                        <td className="px-5 py-3 text-sm text-slate-900">{a.slot_date}</td>
                        <td className="px-5 py-3 text-sm text-slate-600">{formatTime(a.start_time)} – {formatTime(a.end_time)}</td>
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">{a.doctor_name}</td>
                        <td className="px-5 py-3"><StatusBadge status={a.status} attended={a.attended} /></td>
                        <td className="px-5 py-3 text-sm text-slate-500 max-w-[180px] truncate">{a.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {!selectedPatient && results.length === 0 && (
          <Card className="lg:col-span-3">
            <EmptyState
              icon={Search01Icon}
              title="Search for patients"
              description="Enter a name, email, or phone number to find patients."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
