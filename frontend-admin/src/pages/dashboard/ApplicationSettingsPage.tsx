import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Settings01Icon, AlertCircleIcon, CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';

interface Setting {
  id: string;
  group_name: string;
  name: string;
  value: string;
  is_sensitive: boolean;
  description: string;
}

const knownSensitive = ['encryption_key', 'smtp_password', 'jwt_secret'];
const inputClass = "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all";

export function ApplicationSettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState<Record<string, string>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getSettingsGroup('appointment');
      setSettings(data);
      const editMap: Record<string, string> = {};
      data.forEach((s) => {
        editMap[s.name] = knownSensitive.includes(s.name) ? '' : s.value === '********' ? '' : s.value;
      });
      setEditing(editMap);
    } catch (e: any) {
      setError(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (group: string, name: string) => {
    setError('');
    setSuccess('');
    const val = editing[name];
    if (val === undefined) return;
    try {
      await api.updateSetting(group, name, val, token);
      setSuccess(`"${name}" updated successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Failed to update setting');
    }
  };

  const displayName = (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Application Settings"
        description="Configure clinic-wide appointment settings"
        icon={Settings01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 px-4 py-3 rounded-lg ring-1 ring-emerald-200/50">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
          {success}
        </div>
      )}

      <Card>
        <CardHeader
          title="Appointment Settings"
          description="Configure appointment booking parameters and system settings"
        />
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {settings.map((s) => {
              const isSensitive = s.is_sensitive || knownSensitive.includes(s.name);
              return (
                <div key={s.id} className="flex items-end gap-3 pb-5 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-900 mb-1">{displayName(s.name)}</label>
                    <input
                      type={isSensitive ? 'password' : 'text'}
                      value={editing[s.name] ?? ''}
                      onChange={(e) => setEditing(prev => ({ ...prev, [s.name]: e.target.value }))}
                      placeholder={isSensitive ? 'Enter new value to change' : s.value === '********' ? 'Enter new value to change' : s.value}
                      className={inputClass}
                    />
                    {s.description && (
                      <p className="text-xs text-slate-500 mt-1">{s.description}</p>
                    )}
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => handleSave(s.group_name, s.name)}>Save</Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
