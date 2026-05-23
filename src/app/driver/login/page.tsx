'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Logo } from '@/components/layout/Logo';
import { Button, Input, Alert } from '@/components/ui';
import { authService } from '@/services/authService';

type FormValues = { email: string; password: string };

export default function DriverLoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setServerError('');
    const res = await authService.login(values.email, values.password);
    if (!res.data) {
      setServerError(res.error?.message ?? 'Sign in failed. Please check your credentials.');
      return;
    }

    setRedirecting(true);
    try {
      // Determine role after login and route to the correct driver portal page
      const meRes = await fetch('/api/me').then((r) => r.json());
      const role: string = meRes.data?.role ?? 'PARENT';

      if (role === 'DRIVER') {
        // Approved driver → full dashboard
        router.push('/driver/dashboard');
        return;
      }
      if (role === 'ADMIN') {
        // Edge case: admin signed in via driver login
        router.push('/admin');
        return;
      }

      // PARENT role → check if they have an application
      const appRes = await fetch('/api/driver-application').then((r) => r.json());
      const appStatus: string | null = appRes.data?.application?.status ?? null;

      if (appStatus) {
        // Existing application → show status page
        router.push('/driver-application');
      } else {
        // No application yet → start the application form
        router.push('/driver-application');
      }
    } catch {
      router.push('/driver-application');
    }
  };

  return (
    <div className="min-h-screen bg-fizza-bg flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 bg-white">
        <a href="/drive" aria-label="Driver portal home">
          <Logo theme="light" />
        </a>
        <a href="/drive" className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
          ← Driver Portal
        </a>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Driver badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-fizza-primary/10 border border-fizza-primary/20 px-4 py-1.5 text-xs font-semibold text-fizza-primary">
              <span className="text-base">🚗</span>
              Driver Portal
            </span>
          </div>

          <div className="card-md">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900">Driver sign in</h1>
              <p className="text-sm text-gray-500 mt-1">
                Access your driver account and application
              </p>
            </div>

            {serverError && (
              <Alert variant="error" className="mb-4" onClose={() => setServerError('')}>
                {serverError}
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <Input
                label="Email address"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
                })}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                error={errors.password?.message}
                {...register('password', { required: 'Password is required' })}
              />

              <div className="flex justify-end">
                <a href="/reset-password" className="text-xs text-fizza-secondary hover:underline">
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={isSubmitting || redirecting}
                className="w-full"
              >
                {redirecting ? 'Redirecting…' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                New driver?{' '}
                <a href="/driver/register" className="font-semibold text-fizza-secondary hover:underline">
                  Apply now
                </a>
              </p>
            </div>
          </div>

          {/* Separator */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Looking for the family app?{' '}
              <a href="/login" className="text-gray-500 hover:text-gray-700 underline">
                Family sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
