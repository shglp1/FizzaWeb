'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Logo } from '@/components/layout/Logo';
import { Button, Input, Alert } from '@/components/ui';
import { authService } from '@/services/authService';

type FormValues = { email: string };

export default function ResetPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const onSubmit = async (values: FormValues) => {
    setServerError('');
    const res = await authService.resetPassword(values.email);
    if (res.error) {
      setServerError(res.error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-fizza-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Logo theme="light" />
          </Link>
        </div>

        <div className="card-md">
          {sent ? (
            /* Success state */
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#14A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Check your email</h1>
                <p className="text-sm text-gray-500 mt-2">
                  If that email is registered, we&apos;ve sent a reset link. It may take a minute to arrive.
                </p>
              </div>
              <Link href="/login" className="btn-outline w-full text-center mt-2">
                Back to Sign In
              </Link>
            </div>
          ) : (
            /* Form state */
            <>
              <div className="mb-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14A34A" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-gray-900">Reset your password</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your email and we&apos;ll send a reset link.
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
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
                  })}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={isSubmitting}
                  className="w-full"
                >
                  Send Reset Link
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  ← Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
