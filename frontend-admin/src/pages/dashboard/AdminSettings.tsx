import { useState, useEffect, useCallback } from 'react';
import { api, MfaStatus, SetupMfaResponse } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserSettingsIcon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  LockIcon,
  FingerPrintScanIcon,
  Mail01Icon,
  CallIcon,
} from '@hugeicons/core-free-icons';

export function AdminSettings() {
  const { token } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [mfaLoading, setMfaLoading] = useState(true);
  const [mfaMethods, setMfaMethods] = useState<string[]>([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [mfaSaving, setMfaSaving] = useState(false);
  const [mfaSetupResult, setMfaSetupResult] = useState<SetupMfaResponse | null>(null);

  const fetchMfaStatus = useCallback(async () => {
    setMfaLoading(true);
    try {
      const status = await api.mfaStatus(token);
      setMfaStatus(status);
      setMfaMethods(status.mfa_methods);
      setPhoneNumber(status.phone || '');
    } catch {
      // ignore
    } finally {
      setMfaLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMfaStatus(); }, [fetchMfaStatus]);

  const handleSetPassword = async () => {
    if (!newPassword) { setError('New password is required'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setPasswordSaving(true);
    try {
      await api.setPassword(currentPassword || null, newPassword, token);
      setSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      fetchMfaStatus();
    } catch (e: any) {
      setError(e.message || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSetupMfa = async () => {
    setError('');
    if (mfaMethods.length === 0) { setError('Select at least one MFA method'); return; }
    if (mfaMethods.includes('phone') && !phoneNumber.trim()) { setError('Phone number is required for phone MFA'); return; }
    setMfaSaving(true);
    setMfaSetupResult(null);
    try {
      const res = await api.setupMfa(mfaMethods, phoneNumber.trim() || null, token);
      setMfaSetupResult(res);
      setSuccess('MFA settings updated');
      setTimeout(() => setSuccess(''), 3000);
      fetchMfaStatus();
    } catch (e: any) {
      setError(e.message || 'Failed to update MFA');
    } finally {
      setMfaSaving(false);
    }
  };

  const toggleMfaMethod = (method: string) => {
    setMfaMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  const inputClass = "w-full h-9 px-3 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all";

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Account Settings"
        description="Manage your password and security preferences"
        icon={UserSettingsIcon}
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

      {/* Password Section */}
      <Card>
        <CardHeader
          title="Password"
          description={mfaStatus?.has_password ? 'Change your account password' : 'Set a password to enable password-based sign-in'}
        />
        {mfaLoading ? (
          <div className="h-20 bg-muted rounded-lg animate-pulse" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mfaStatus?.has_password && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Current Password</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className={inputClass} />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" className={inputClass} />
              </div>
            </div>
            <Button size="sm" onClick={handleSetPassword} loading={passwordSaving} disabled={!newPassword || newPassword !== confirmPassword}>
              {mfaStatus?.has_password ? 'Change Password' : 'Set Password'}
            </Button>
          </div>
        )}
      </Card>

      {/* MFA Section */}
      <Card>
        <CardHeader
          title="Multi-Factor Authentication"
          description="Choose at least one verification method for sign-in"
        />
        {mfaLoading ? (
          <div className="h-32 bg-muted rounded-lg animate-pulse" />
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                mfaMethods.includes('email') ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={mfaMethods.includes('email')}
                  onChange={() => toggleMfaMethod('email')}
                  className="rounded border-slate-300 size-4 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <HugeiconsIcon icon={Mail01Icon} className="size-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-xs text-muted-foreground">Receive a code at {mfaStatus?.email || 'your email'}</p>
                </div>
                {mfaMethods.includes('email') && <Badge variant="success">Active</Badge>}
              </label>

              <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                mfaMethods.includes('phone') ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={mfaMethods.includes('phone')}
                  onChange={() => toggleMfaMethod('phone')}
                  className="rounded border-slate-300 size-4 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="size-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <HugeiconsIcon icon={CallIcon} className="size-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Phone (SMS)</p>
                  <p className="text-xs text-muted-foreground">Receive a code via SMS</p>
                </div>
                {mfaMethods.includes('phone') && <Badge variant="success">Active</Badge>}
              </label>

              {mfaMethods.includes('phone') && (
                <div className="pl-14">
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+233501234567"
                    className={`${inputClass} max-w-xs`}
                  />
                </div>
              )}

              <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                mfaMethods.includes('authenticator') ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={mfaMethods.includes('authenticator')}
                  onChange={() => toggleMfaMethod('authenticator')}
                  className="rounded border-slate-300 size-4 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="size-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <HugeiconsIcon icon={FingerPrintScanIcon} className="size-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Authenticator App</p>
                  <p className="text-xs text-muted-foreground">Google Authenticator, Authy, or any TOTP app</p>
                </div>
                {mfaMethods.includes('authenticator') && <Badge variant="success">Active</Badge>}
              </label>
            </div>

            {mfaSetupResult?.qr_code_svg && (
              <div className="rounded-xl border border-border p-5 bg-muted flex flex-col items-center gap-3">
                <p className="text-xs font-medium text-muted-foreground">Scan with your authenticator app</p>
                <div className="size-48 bg-card rounded-lg p-2 shadow-sm" dangerouslySetInnerHTML={{ __html: mfaSetupResult.qr_code_svg }} />
                <p className="text-[10px] text-muted-foreground break-all font-mono text-center max-w-full">
                  Secret: {mfaSetupResult.mfa_secret}
                </p>
              </div>
            )}

            <Button size="sm" onClick={handleSetupMfa} loading={mfaSaving} disabled={mfaMethods.length === 0}>
              Save MFA Settings
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
