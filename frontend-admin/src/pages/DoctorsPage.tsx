import { useState, useEffect } from 'react';
import { api, DoctorFull } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Delete01Icon,
  Edit01Icon,
  AlertCircleIcon,
  StethoscopeIcon,
  Cancel01Icon,
  Mail01Icon,
  CallIcon,
} from '@hugeicons/core-free-icons';

export function DoctorsPage() {
  const { token, userRole } = useAuth();
  const [doctors, setDoctors] = useState<DoctorFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<DoctorFull | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', specialization: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const data = await api.getDoctors();
      const full: DoctorFull[] = await Promise.all(
        data.map(d => api.getDoctor(d.id, token).catch(() => ({ ...d, email: '', phone: null, created_at: '' } as DoctorFull)))
      );
      setDoctors(full);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDoctors(); }, []);

  const resetForm = () => {
    setForm({ first_name: '', last_name: '', specialization: '', email: '', phone: '' });
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (d: DoctorFull) => {
    setForm({ first_name: d.first_name, last_name: d.last_name, specialization: d.specialization, email: d.email, phone: d.phone || '' });
    setEditing(d);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.updateDoctor(editing.id, form, token);
      } else {
        await api.createDoctor(form, token);
      }
      resetForm();
      await fetchDoctors();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this doctor?')) return;
    try {
      await api.deleteDoctor(id, token);
      setDoctors(prev => prev.filter(d => d.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctors"
        description="Manage clinic doctors and their information"
        icon={StethoscopeIcon}
        actions={
          userRole === 'admin' && !showForm ? (
            <Button onClick={() => setShowForm(true)} icon={Add01Icon}>
              Add Doctor
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader
            title={editing ? 'Edit Doctor' : 'New Doctor'}
            description={editing ? 'Update doctor information' : 'Add a new doctor to the clinic'}
            action={
              <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="size-4 text-slate-400" />
              </button>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">First Name *</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Last Name *</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="Enter last name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Specialization *</label>
              <input
                value={form.specialization}
                onChange={(e) => setForm(f => ({ ...f, specialization: e.target.value }))}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="e.g., Cardiology"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="doctor@hospital.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <Button onClick={handleSave} loading={saving} disabled={!form.first_name || !form.last_name || !form.specialization || !form.email}>
              {editing ? 'Update Doctor' : 'Create Doctor'}
            </Button>
            <Button variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card padding="none">
        {loading ? (
          <div className="p-8">
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ) : doctors.length === 0 ? (
          <EmptyState
            icon={StethoscopeIcon}
            title="No doctors registered"
            description="Add your first doctor to get started."
            action={
              userRole === 'admin' ? (
                <Button size="sm" onClick={() => setShowForm(true)} icon={Add01Icon}>
                  Add Doctor
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Doctor</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Specialization</th>
                  <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Contact</th>
                  {userRole === 'admin' && <th className="w-24 px-5 py-3"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {doctors.map((d) => (
                  <tr key={d.id} className="transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md" style={{ transformOrigin: 'center' }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                          {d.first_name[0]}{d.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">Dr. {d.first_name} {d.last_name}</p>
                          <p className="text-xs text-slate-400">{d.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-600">{d.specialization}</td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <HugeiconsIcon icon={Mail01Icon} className="size-3" />
                          {d.email}
                        </div>
                        {d.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <HugeiconsIcon icon={CallIcon} className="size-3" />
                            {d.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    {userRole === 'admin' && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(d)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <HugeiconsIcon icon={Edit01Icon} className="size-4 text-slate-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <HugeiconsIcon icon={Delete01Icon} className="size-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    )}
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
