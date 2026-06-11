import { useState, useEffect } from 'react';
import { api, ProfileResponse } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  UserIcon,
  AlertCircleIcon,
  Mail01Icon,
  CallIcon,
  StethoscopeIcon,
  Calendar01Icon,
  IdVerifiedIcon,
} from '@hugeicons/core-free-icons';

export function DoctorProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getProfile(token);
        setProfile(data);
      } catch (e: any) {
        setError(e.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" description="Your account and professional details" icon={UserIcon} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card rounded-xl border border-border/80 p-6 h-48 animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-4" />
              <div className="h-3 w-full bg-muted rounded mb-2" />
              <div className="h-3 w-3/4 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" description="Your account and professional details" icon={UserIcon} />
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-4 py-3 rounded-lg ring-1 ring-red-200/50">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const fullName = profile.first_name && profile.last_name
    ? `Dr. ${profile.first_name} ${profile.last_name}`
    : profile.identifier;

  const initials = profile.first_name && profile.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`
    : profile.identifier[0].toUpperCase();

  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Your account and professional details"
        icon={UserIcon}
      />

      {/* Profile Header Card */}
      <Card>
        <div className="flex items-start gap-5">
          <div className="size-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-200/50 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground">{fullName}</h2>
            {profile.specialization && (
              <p className="text-sm text-muted-foreground mt-0.5">{profile.specialization}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="success">{profile.role}</Badge>
              {profile.doctor_id && <Badge variant="info">Verified Doctor</Badge>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Professional Information */}
        {profile.doctor_id && (
          <Card>
            <CardHeader
              title="Professional Information"
              description="Your medical practice details"
            />
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={StethoscopeIcon} className="size-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Specialization</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{profile.specialization || '—'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={IdVerifiedIcon} className="size-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Doctor ID</p>
                  <p className="text-sm font-mono text-muted-foreground mt-0.5">{profile.doctor_id}</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Contact Information */}
        <Card>
          <CardHeader
            title="Contact Information"
            description="Your registered contact details"
          />
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <HugeiconsIcon icon={Mail01Icon} className="size-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{profile.email || profile.identifier}</p>
              </div>
            </div>
            {profile.phone && (
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={CallIcon} className="size-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{profile.phone}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Account Information */}
        <Card className="md:col-span-2">
          <CardHeader
            title="Account Information"
            description="Your system account details"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <HugeiconsIcon icon={UserIcon} className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{profile.identifier}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                <HugeiconsIcon icon={IdVerifiedIcon} className="size-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</p>
                <p className="text-sm font-medium text-foreground mt-0.5 capitalize">{profile.role}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                <HugeiconsIcon icon={Calendar01Icon} className="size-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Member Since</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{joinDate}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
