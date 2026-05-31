import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export function AdminSettings() {
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage clinic configuration</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 px-4 py-3 rounded-lg">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Settings01Icon} className="size-4 text-primary" />
            Appointment Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground animate-skeleton">Loading settings...</div>
          ) : (
            <div className="space-y-4">
              {settings.map((s) => {
                const isSensitive = s.is_sensitive || knownSensitive.includes(s.name);
                return (
                  <div key={s.id} className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-muted-foreground mb-1">{displayName(s.name)}</label>
                      <Input
                        type={isSensitive ? 'password' : 'text'}
                        value={editing[s.name] ?? ''}
                        onChange={(e) => setEditing(prev => ({ ...prev, [s.name]: e.target.value }))}
                        placeholder={isSensitive ? 'Enter new value to change' : s.value === '********' ? 'Enter new value to change' : s.value}
                      />
                      {s.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{s.description}</p>
                      )}
                    </div>
                    <Button size="sm" onClick={() => handleSave(s.group_name, s.name)}>Save</Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
