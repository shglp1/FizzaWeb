'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Logo } from '@/components/layout/Logo';
import { Button, Input, Alert } from '@/components/ui';
import { authService } from '@/services/authService';

type FormValues = { email: string; password: string };

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setServerError('');
    const res = await authService.login(values.email, values.password);
    if (res.data) {
      router.push('/dashboard');
    } else {
      setServerError(res.error?.message ?? 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-fizza-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Logo theme="light" />
          </Link>
        </div>

        <div className="card-md">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to your Fizza account</p>
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
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
              })}
            />
            <div className="field">
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="password">Password</label>
                <Link
                  href="/reset-password"
                  className="text-xs text-fizza-secondary hover:text-fizza-primary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className={errors.password ? 'input-error' : 'input'}
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && (
                <p className="field-error">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              className="w-full"
            >
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-fizza-secondary font-semibold hover:text-fizza-primary transition-colors">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}
