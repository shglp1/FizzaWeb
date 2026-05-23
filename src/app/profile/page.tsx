'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader,
  Card,
  Input,
  Button,
  Alert,
  Badge,
  LoadingState,
  ErrorState,
} from '@/components/ui';
import { profileService } from '@/services/profileService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  user: { email: string; role: string };
};

type FormValues = { fullName: string; phone: string; avatarUrl: string };

const ROLE_BADGE: Record<string, 'success' | 'info' | 'warning' | 'purple' | 'gray'> = {
  PARENT: 'success',
  RIDER: 'info',
  DRIVER: 'warning',
  ADMIN: 'purple',
};

const ROLE_LABEL: Record<string, string> = {
  PARENT: 'Parent',
  RIDER: 'Rider',
  DRIVER: 'Driver',
  ADMIN: 'Admin',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  useEffect(() => {
    profileService.get().then((res) => {
      if (res.data?.profile) {
        const p: Profile = res.data.profile;
        setProfile(p);
        reset({ fullName: p.fullName ?? '', phone: p.phone ?? '', avatarUrl: p.avatarUrl ?? '' });
      } else {
        setError('Could not load profile.');
      }
      setLoading(false);
    });
  }, [reset]);

  const onSubmit = async (values: FormValues) => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const res = await profileService.update({
        fullName: values.fullName || undefined,
        phone: values.phone || undefined,
        avatarUrl: values.avatarUrl || undefined,
      });
      if (res.data?.profile) {
        setProfile(res.data.profile);
        setSuccess('Profile updated successfully.');
      } else {
        setError(res.error?.message ?? 'Update failed.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppShell><LoadingState message="Loading profile…" /></AppShell>;

  if (!profile) return (
    <AppShell>
      <ErrorState message={error || 'Profile not found.'} onRetry={() => window.location.reload()} />
    </AppShell>
  );

  const role = profile.user.role;

  return (
    <AppShell>
      <PageHeader title="My Profile" subtitle="Manage your personal information and account" />

      <div className="grid md:grid-cols-5 gap-5">
        {/* Left — avatar + account summary */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Avatar card */}
          <Card>
            <div className="flex flex-col items-center text-center gap-3 py-4">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border-4 border-emerald-100 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-fizza-secondary to-fizza-primary flex items-center justify-center text-3xl font-bold text-white shadow-sm">
                  {profile.fullName?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              )}
              <div>
                <p className="font-bold text-gray-900 text-lg">{profile.fullName}</p>
                <p className="text-sm text-gray-500">{profile.user.email}</p>
              </div>
              <Badge variant={ROLE_BADGE[role] ?? 'gray'}>
                {ROLE_LABEL[role] ?? role}
              </Badge>
            </div>

            <div className="divider" />

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-800 truncate ml-2">{profile.user.email}</span>
              </div>
              {profile.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Phone</span>
                  <span className="font-medium text-gray-800">{profile.phone}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Account type</span>
                <Badge variant={ROLE_BADGE[role] ?? 'gray'}>
                  {ROLE_LABEL[role] ?? role}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Driver CTA / Driver status */}
          {role !== 'DRIVER' && role !== 'ADMIN' && (
            <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fizza-secondary/10 text-fizza-secondary shrink-0">
                  🚗
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">Become a Driver</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Apply and earn on your own schedule.
                  </p>
                  <Link href="/driver-application" className="btn-secondary btn-sm mt-3 inline-flex">
                    Apply Now →
                  </Link>
                </div>
              </div>
            </Card>
          )}

          {role === 'DRIVER' && (
            <Card className="bg-amber-50 border-amber-200">
              <div className="flex items-center gap-3">
                <div className="text-2xl">✅</div>
                <div>
                  <h3 className="font-semibold text-amber-900">Driver Account</h3>
                  <p className="text-sm text-amber-700">Your application is approved.</p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right — edit form */}
        <div className="md:col-span-3">
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-5">Personal Information</h2>

            {success && (
              <Alert variant="success" className="mb-4" onClose={() => setSuccess('')}>{success}</Alert>
            )}
            {error && (
              <Alert variant="error" className="mb-4" onClose={() => setError('')}>{error}</Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Full name"
                placeholder="Your full name"
                required
                error={errors.fullName?.message}
                {...register('fullName', { required: 'Name is required' })}
              />
              <Input
                label="Phone number"
                type="tel"
                placeholder="+966 5X XXX XXXX"
                helpText="Used for trip notifications"
                {...register('phone')}
              />
              <Input
                label="Avatar URL"
                type="url"
                placeholder="https://example.com/avatar.jpg"
                helpText="Link to a profile photo (optional)"
                {...register('avatarUrl')}
              />

              <div className="pt-2">
                <Button type="submit" variant="primary" loading={saving} className="w-full sm:w-auto">
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
