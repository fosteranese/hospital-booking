import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Settings01Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Mail01Icon,
  Calendar01Icon,
  Edit01Icon,
  Cancel01Icon,
  LockIcon,
} from '@hugeicons/core-free-icons';

interface Setting {
  id: string;
  group_name: string;
  name: string;
  value: string;
  is_sensitive: boolean;
  description: string;
  value_type: string;
}

interface GroupedTab {
  key: string;
  label: string;
  description: string;
  icon: any;
  settings: Setting[];
}

const knownSensitive = ['encryption_key', 'smtp_password', 'jwt_secret'];

const TYPE_BADGE: Record<string, { label: string; class: string }> = {
  integer:   { label: 'int',    class: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/50' },
  double:    { label: 'double', class: 'bg-blue-50 text-blue-600 ring-1 ring-blue-200/50' },
  time:      { label: 'time',   class: 'bg-violet-50 text-violet-600 ring-1 ring-violet-200/50' },
  date:      { label: 'date',   class: 'bg-violet-50 text-violet-600 ring-1 ring-violet-200/50' },
  datetime:  { label: 'dt',     class: 'bg-violet-50 text-violet-600 ring-1 ring-violet-200/50' },
  text:      { label: 'text',   class: 'bg-slate-50 text-slate-500 ring-1 ring-slate-200/50' },
  email:     { label: 'email',  class: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/50' },
  password:  { label: 'pwd',    class: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/50' },
  pin:       { label: 'pin',    class: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/50' },
  url:       { label: 'url',    class: 'bg-cyan-50 text-cyan-600 ring-1 ring-cyan-200/50' },
  address:   { label: 'addr',   class: 'bg-teal-50 text-teal-600 ring-1 ring-teal-200/50' },
  phone:     { label: 'phone',  class: 'bg-green-50 text-green-600 ring-1 ring-green-200/50' },
  image:     { label: 'img',    class: 'bg-pink-50 text-pink-600 ring-1 ring-pink-200/50' },
  ipv4:      { label: 'ipv4',   class: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/50' },
  ipv6:      { label: 'ipv6',   class: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/50' },
};

const TAB_META: Record<string, { label: string; description: string; icon: any }> = {
  appointment: { label: 'Appointment', description: 'Booking rules and schedule',            icon: Calendar01Icon },
  clinic:      { label: 'Clinic',      description: 'Clinic name and contact information',    icon: Settings01Icon },
  smtp:        { label: 'SMTP',        description: 'Email server configuration',             icon: Mail01Icon },
  otp:         { label: 'OTP',         description: 'One-time password settings',             icon: Settings01Icon },
};

function validateByType(value: string, valueType: string): string | null {
  if (!value) return null;
  switch (valueType) {
    case 'integer':
      return /^-?\d+$/.test(value) ? null : 'Must be a valid integer';
    case 'double':
      return /^-?\d+(\.\d+)?$/.test(value) ? null : 'Must be a valid number';
    case 'time':
      return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? null : 'Must be HH:MM (24-hour)';
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? null : 'Must be YYYY-MM-DD';
    case 'datetime':
      return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}$/.test(value) ? null : 'Must be YYYY-MM-DD HH:MM:SS';
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Must be a valid email';
    case 'url':
      return value.startsWith('http://') || value.startsWith('https://') ? null : 'Must start with http:// or https://';
    case 'ipv4':
      return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) ? null : 'Must be a valid IPv4 address';
    case 'ipv6':
      return value.includes(':') ? null : 'Must be a valid IPv6 address';
    case 'phone':
      return /^[\d\s+\-()]{5,}$/.test(value) ? null : 'Must be a valid phone number';
    case 'boolean':
      return ['true', 'false'].includes(value.toLowerCase()) ? null : 'Must be true or false';
    default:
      return null;
  }
}

function inputTypeFor(isSensitive: boolean, valueType: string): string {
  if (isSensitive) return 'password';
  switch (valueType) {
    case 'integer':  return 'number';
    case 'double':   return 'number';
    case 'time':     return 'time';
    case 'date':     return 'date';
    case 'datetime': return 'datetime-local';
    case 'email':    return 'email';
    case 'password':
    case 'pin':      return 'password';
    case 'url':      return 'url';
    default:         return 'text';
  }
}

function displayName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function displayValue(setting: Setting): { text: string; masked: boolean } {
  if (setting.is_sensitive || knownSensitive.includes(setting.name)) {
    return { text: '********', masked: true };
  }
  if (!setting.value) return { text: '(empty)', masked: false };
  return { text: setting.value, masked: false };
}

export function ApplicationSettingsPage() {
  const { token } = useAuth();
  const [tabs, setTabs] = useState<GroupedTab[]>([]);
  const [activeTab, setActiveTab] = useState('appointment');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal state
  const [editSetting, setEditSetting] = useState<Setting | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchAllGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const groups = ['appointment', 'clinic', 'smtp', 'otp'];
      const results = await Promise.all(
        groups.map(g => api.getSettingsGroup(g).catch(() => null))
      );
      const loaded: GroupedTab[] = [];
      groups.forEach((g, i) => {
        const data = results[i];
        if (data && data.length > 0) {
          loaded.push({ key: g, ...TAB_META[g], settings: data });
        }
      });
      setTabs(loaded);
      if (loaded.length > 0 && !loaded.find(t => t.key === activeTab)) {
        setActiveTab(loaded[0].key);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAllGroups(); }, [fetchAllGroups]);

  const openEditModal = (s: Setting) => {
    const val = knownSensitive.includes(s.name) ? ''
      : s.value === '********' ? ''
      : s.value;
    setEditSetting(s);
    setEditValue(val);
    setEditError(null);
    setEditSaving(false);
  };

  const closeEditModal = () => {
    setEditSetting(null);
    setEditValue('');
    setEditError(null);
    setEditSaving(false);
  };

  const handleModalChange = (value: string) => {
    setEditValue(value);
    if (editSetting) {
      setEditError(validateByType(value, editSetting.value_type));
    }
  };

  const handleModalSave = async () => {
    if (!editSetting) return;
    const err = validateByType(editValue, editSetting.value_type);
    if (err) { setEditError(err); return; }
    setEditSaving(true);
    try {
      await api.updateSetting(editSetting.group_name, editSetting.name, editValue, token);
      setSuccess(`"${displayName(editSetting.name)}" updated`);
      setTimeout(() => setSuccess(''), 3000);
      setRefreshKey(k => k + 1);
      closeEditModal();
    } catch (e: any) {
      setEditError(e.message || 'Failed to update setting');
    } finally {
      setEditSaving(false);
    }
  };

  const currentTab = tabs.find(t => t.key === activeTab);
  const settings = currentTab?.settings ?? [];

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Application Settings"
        description="Configure clinic-wide system settings"
        icon={Settings01Icon}
      />

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3.5 py-2.5 rounded-lg">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3.5 py-2.5 rounded-lg">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5 shrink-0" />
          {success}
        </div>
      )}

      {loading ? (
        <Card padding="lg">
          <div className="space-y-4">
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-9 w-28 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-slate-50 rounded-lg animate-pulse" />
            ))}
          </div>
        </Card>
      ) : (
        <Card padding="none">
          {/* Tab bar — GC-inspired clean underline */}
          <div className="flex gap-1 px-5 pt-3 border-b border-slate-100 overflow-x-auto flex-nowrap">
            {tabs.map(tab => {
              const meta = TAB_META[tab.key] || { label: tab.key, description: '', icon: Settings01Icon };
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium transition-all relative ${
                    isActive
                      ? 'text-emerald-700'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <HugeiconsIcon icon={meta.icon} className="size-3.5" />
                  {meta.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {currentTab && (
            <div>
              {settings.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">No settings found in this group.</div>
              ) : (
                <div className="overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-50">
                        <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5 w-[35%]">Setting</th>
                        <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5">Current Value</th>
                        <th className="text-left text-xs font-medium text-slate-400 px-5 py-2.5 w-[60px]">Type</th>
                        <th className="text-right text-xs font-medium text-slate-400 px-5 py-2.5 w-[70px]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settings.map(s => {
                        const badge = TYPE_BADGE[s.value_type] || TYPE_BADGE.text;
                        const dv = displayValue(s);
                        return (
                          <tr key={s.id} className="group transition-all duration-150 hover:bg-slate-50/80 hover:scale-[1.02] hover:shadow-md border-b border-slate-50 last:border-0" style={{ transformOrigin: 'center' }}>
                            <td className="py-2.5 px-5 align-top">
                              <div className="pt-0.5">
                                <span className="text-sm font-medium text-slate-900">{displayName(s.name)}</span>
                                {s.description && (
                                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed max-w-md">{s.description}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-5 align-top">
                              <div className="pt-0.5 flex items-center gap-2">
                                <span className={`text-sm ${dv.masked ? 'text-slate-300 font-mono tracking-widest' : 'text-slate-700'}`}>
                                  {dv.text}
                                </span>
                                {dv.masked && (
                                  <HugeiconsIcon icon={LockIcon} className="size-3 text-slate-300 shrink-0" />
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-5 align-top">
                              <div className="pt-1">
                                <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge.class}`}>
                                  {badge.label}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-5 align-top text-right">
                              <div className="pt-0.5">
                                <Button size="sm" variant="ghost" icon={Edit01Icon} onClick={() => openEditModal(s)}>
                                  Edit
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!currentTab && !loading && (
            <div className="py-12 text-center text-sm text-slate-400">No settings groups available.</div>
          )}
        </Card>
      )}

      {/* Edit Modal */}
      {editSetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeEditModal}>
          <div className="absolute inset-0 bg-black/15" />
          <div
            className="relative bg-white rounded-xl shadow-xl w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{displayName(editSetting.name)}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{editSetting.group_name}</p>
              </div>
              <button onClick={closeEditModal} className="p-1 rounded-md hover:bg-slate-100 transition-colors text-slate-400">
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {editSetting.description && (
                <p className="text-xs text-slate-500 leading-relaxed">{editSetting.description}</p>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Current Value</label>
                <div className="text-sm text-slate-700 bg-slate-50 rounded-md px-3.5 py-2 font-mono">
                  {editSetting.is_sensitive || knownSensitive.includes(editSetting.name)
                    ? '********'
                    : editSetting.value || '(empty)'}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">New Value</label>
                {editSetting.value_type === 'boolean' ? (
                  <select
                    value={editValue}
                    onChange={e => handleModalChange(e.target.value)}
                    className={[
                      'w-full h-9 px-3.5 text-sm border rounded-md bg-white transition-all appearance-none cursor-pointer',
                      'focus:outline-none focus:ring-2 focus:border-emerald-500',
                      editError
                        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-slate-200 focus:ring-emerald-500/20',
                    ].join(' ')}
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                ) : (
                  <input
                    type={inputTypeFor(editSetting.is_sensitive, editSetting.value_type)}
                    step={editSetting.value_type === 'integer' ? '1' : editSetting.value_type === 'double' ? 'any' : undefined}
                    value={editValue}
                    onChange={e => handleModalChange(e.target.value)}
                    placeholder="Enter new value"
                    autoFocus
                    className={[
                      'w-full h-9 px-3.5 text-sm border rounded-md bg-white transition-all',
                      'focus:outline-none focus:ring-2 focus:border-emerald-500',
                      editError
                        ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                        : 'border-slate-200 focus:ring-emerald-500/20',
                    ].join(' ')}
                  />
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${(TYPE_BADGE[editSetting.value_type] || TYPE_BADGE.text).class}`}>
                    {(TYPE_BADGE[editSetting.value_type] || TYPE_BADGE.text).label}
                  </span>
                  {editSetting.is_sensitive && (
                    <span className="text-xs text-slate-400">Encrypted</span>
                  )}
                </div>
                {editError && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <HugeiconsIcon icon={AlertCircleIcon} className="size-3 shrink-0" />
                    {editError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100">
              <Button variant="ghost" onClick={closeEditModal} disabled={editSaving} size="sm">
                Cancel
              </Button>
              <Button variant="primary" loading={editSaving} disabled={!!editError || editSaving} onClick={handleModalSave} size="sm">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
