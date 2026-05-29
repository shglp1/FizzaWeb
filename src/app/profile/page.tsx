'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
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
import { CheckCircle, ClipboardList, Car, Users, Wallet, Shield, MapPin } from 'lucide-react';
import { profileService } from '@/services/profileService';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { FileUploadField } from '@/components/upload/FileUploadField';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileExtras = {
  ridersCount?: number;
  activeSubscriptions?: number;
  walletBalanceSar?: number;
  vehicleSummary?: string | null;
  driverRating?: string | null;
};

type Profile = {
  id: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  user: { email: string; role: string };
  extras?: ProfileExtras;
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
  const { user } = useCurrentUser();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>();
  const avatarUrl = watch('avatarUrl');

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
  const driverState = user?.driverState;

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

          {/* Driver application status — only for driver applicants */}
          {driverState === 'DRIVER_APPLICANT' && (
            <Card className="bg-amber-50/60 border-amber-200">
              <div className="flex items-start gap-3">
                <ClipboardList className="h-8 w-8 text-amber-700 shrink-0" strokeWidth={1.75} aria-hidden />
                <div>
                  <h3 className="font-semibold text-amber-900">Driver Application</h3>
                  <p className="text-sm text-amber-700 mt-0.5">
                    Your driver application is being reviewed.
                  </p>
                  <a href="/driver-application" className="btn-secondary btn-sm mt-3 inline-flex">
                    View Application →
                  </a>
                </div>
              </div>
            </Card>
          )}

          {/* Approved driver card */}
          {driverState === 'APPROVED_DRIVER' && (
            <Card className="bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-emerald-600" strokeWidth={1.75} aria-hidden />
                <div>
                  <h3 className="font-semibold text-emerald-900">Approved Driver</h3>
                  <p className="text-sm text-emerald-700">Your driver account is active.</p>
                  {profile.extras?.vehicleSummary && (
                    <p className="text-xs text-emerald-800 mt-1 flex items-center gap-1">
                      <Car className="h-3.5 w-3.5" aria-hidden />
                      {profile.extras.vehicleSummary}
                    </p>
                  )}
                  {profile.extras?.driverRating && (
                    <p className="text-xs text-emerald-800">Rating: {Number(profile.extras.driverRating).toFixed(1)} / 5</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Link href="/driver/dashboard" className="btn-secondary btn-sm inline-flex">Driver Dashboard →</Link>
                    <Link href="/driver/earnings" className="btn-secondary btn-sm inline-flex">Earnings</Link>
                    <Link href="/tracking" className="btn-secondary btn-sm inline-flex">Live GPS</Link>
                    <Link href="/safety" className="btn-secondary btn-sm inline-flex">Safety</Link>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {role === 'ADMIN' && (
            <Card className="bg-purple-50 border-purple-200">
              <div className="flex items-start gap-3">
                <Shield className="h-8 w-8 text-purple-600 shrink-0" strokeWidth={1.75} aria-hidden />
                <div>
                  <h3 className="font-semibold text-purple-900">Administrator</h3>
                  <p className="text-sm text-purple-700 mt-0.5">Manage platform operations and users.</p>
                  <a href="/admin" className="btn-secondary btn-sm mt-2 inline-flex">Admin Panel →</a>
                </div>
              </div>
            </Card>
          )}

          {(role === 'PARENT' && driverState === 'PARENT') && (
            <Card>
              <h3 className="font-semibold text-gray-900 mb-3">Family account</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-gray-600">
                  <Users className="h-4 w-4 text-emerald-600" aria-hidden />
                  {profile.extras?.ridersCount ?? 0} riders
                </p>
                <p className="flex items-center gap-2 text-gray-600">
                  <MapPin className="h-4 w-4 text-blue-600" aria-hidden />
                  {profile.extras?.activeSubscriptions ?? 0} active subscriptions
                </p>
                <p className="flex items-center gap-2 text-gray-600">
                  <Wallet className="h-4 w-4 text-amber-600" aria-hidden />
                  Wallet: SAR {Number(profile.extras?.walletBalanceSar ?? 0).toFixed(2)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Link href="/riders" className="btn-secondary btn-sm">Manage riders</Link>
                <Link href="/subscriptions" className="btn-secondary btn-sm">Subscriptions</Link>
                <Link href="/trips" className="btn-secondary btn-sm">Trip history</Link>
                <Link href="/wallet" className="btn-secondary btn-sm">Wallet</Link>
                <Link href="/safety" className="btn-secondary btn-sm">Safety center</Link>
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
              <FileUploadField
                category="profile-avatar"
                value={avatarUrl}
                onChange={(url) => setValue('avatarUrl', url ?? '', { shouldDirty: true })}
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
