'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { profileService } from '@/services/profileService';

type Profile = {
  id: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  user: { email: string; role: string };
};

type FormValues = { fullName: string; phone: string; avatarUrl: string };

const ROLE_LABELS: Record<string, string> = {
  PARENT: 'Parent',
  RIDER: 'Rider',
  DRIVER: 'Driver',
  ADMIN: 'Admin',
};

const ROLE_COLORS: Record<string, string> = {
  PARENT: 'bg-emerald-100 text-emerald-800',
  RIDER: 'bg-blue-100 text-blue-800',
  DRIVER: 'bg-amber-100 text-amber-800',
  ADMIN: 'bg-purple-100 text-purple-800',
};

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
        reset({
          fullName: p.fullName ?? '',
          phone: p.phone ?? '',
          avatarUrl: p.avatarUrl ?? '',
        });
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

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-48 text-gray-400">Loading profile…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold mb-6">My Profile</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Edit form */}
        <div className="card">
          <h2 className="font-semibold text-lg mb-4">Personal Information</h2>

          {profile?.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover mb-4 border-2 border-emerald-200"
            />
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                className="input"
                placeholder="Full Name"
                {...register('fullName', { required: 'Name is required' })}
              />
              {errors.fullName && (
                <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className="input" placeholder="+966 5X XXX XXXX" {...register('phone')} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Avatar URL{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                className="input"
                placeholder="https://example.com/avatar.jpg"
                {...register('avatarUrl')}
              />
            </div>

            {success && (
              <p className="text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 text-sm">
                {success}
              </p>
            )}
            {error && (
              <p className="text-red-600 bg-red-50 rounded-lg px-3 py-2 text-sm">{error}</p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Account info */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Account</h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Email</span>
                <p className="font-medium mt-0.5">{profile?.user.email}</p>
              </div>
              <div>
                <span className="text-gray-500">Role</span>
                <p className="mt-0.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                      ROLE_COLORS[profile?.user.role ?? ''] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {ROLE_LABELS[profile?.user.role ?? ''] ?? profile?.user.role}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Driver application CTA — hide for existing approved drivers */}
          {profile?.user.role !== 'DRIVER' && profile?.user.role !== 'ADMIN' && (
            <div className="card border-emerald-200 bg-emerald-50">
              <h2 className="font-semibold text-emerald-900 mb-1">Become a Driver</h2>
              <p className="text-sm text-emerald-700 mb-3">
                Apply to drive on the FIZZA platform and earn on your own schedule.
              </p>
              <Link href={{ pathname: '/driver-application' }} className="btn-primary text-sm px-4 py-2 inline-block rounded-xl">
                Apply Now →
              </Link>
            </div>
          )}

          {profile?.user.role === 'DRIVER' && (
            <div className="card border-amber-200 bg-amber-50">
              <h2 className="font-semibold text-amber-900 mb-1">Driver Account</h2>
              <p className="text-sm text-amber-700">Your driver application is approved.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
