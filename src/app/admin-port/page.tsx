'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Shield } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';
import { Button, Input, Alert } from '@/components/ui';
import { authService } from '@/services/authService';
import { resolveAdminPortLoginRedirect } from '@/lib/authRedirect';

type FormValues = { email: string; password: string };

export default function AdminPortLoginPage() {
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
      setServerError(res.error?.message ?? 'Login failed. Please try again.');
      return;
    }

    if (res.data.user.role !== 'ADMIN') {
      setServerError('This portal is for Fizza administrators only.');
      await authService.logout();
      return;
    }

    setRedirecting(true);
    const from = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('from')
      : null;
    router.push(resolveAdminPortLoginRedirect(from) as '/admin');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Logo theme="dark" />
          </Link>
        </div>

        <div className="card-md border-gray-700 bg-gray-800/80">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 mb-3">
              <Shield className="h-6 w-6 text-purple-300" aria-hidden />
            </div>
            <h1 className="text-xl font-bold text-white">Admin Portal</h1>
            <p className="text-sm text-gray-400 mt-1">Sign in with your administrator account</p>
          </div>

          {serverError && (
            <Alert variant="error" className="mb-4" onClose={() => setServerError('')}>
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Admin email"
              type="email"
              autoComplete="email"
              placeholder="admin@fizza.sa"
              required
              error={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
              })}
            />
            <div className="field">
              <label className="label text-gray-300" htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                className="input"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>
            <Button type="submit" variant="primary" className="w-full" loading={isSubmitting || redirecting}>
              Sign in to Admin
            </Button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-6">
            Family or driver account?{' '}
            <Link href="/login" className="text-purple-300 hover:underline">Use family login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
