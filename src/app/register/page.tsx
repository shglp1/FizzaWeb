'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { Logo } from '@/components/layout/Logo';
import { Button, Input, Alert } from '@/components/ui';
import { authService } from '@/services/authService';

type FormValues = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  const password = watch('password');

  const onSubmit = async (values: FormValues) => {
    setServerError('');
    const res = await authService.register(values.email, values.password, values.fullName, values.phone);
    if (res.data) {
      router.push('/dashboard');
    } else {
      setServerError(res.error?.message ?? 'Registration failed. Please try again.');
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
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-900">Create your account</h1>
            <p className="text-sm text-gray-500 mt-1">Safe rides for your family, starting today</p>
          </div>

          {serverError && (
            <Alert variant="error" className="mb-4" onClose={() => setServerError('')}>
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Input
              label="Full name"
              type="text"
              autoComplete="name"
              placeholder="Sarah Al-Ghamdi"
              required
              error={errors.fullName?.message}
              {...register('fullName', {
                required: 'Full name is required',
                minLength: { value: 2, message: 'Must be at least 2 characters' },
              })}
            />
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
            <Input
              label="Phone number"
              type="tel"
              autoComplete="tel"
              placeholder="+966 5x xxx xxxx"
              helpText="Optional — used for trip notifications"
              error={errors.phone?.message}
              {...register('phone', {
                minLength: { value: 9, message: 'Enter at least 9 digits' },
              })}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              required
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Must be at least 8 characters' },
              })}
            />
            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              required
              error={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (v) => v === password || 'Passwords do not match',
              })}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={isSubmitting}
              className="w-full mt-2"
            >
              Create Account
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            By creating an account you agree to our{' '}
            <span className="text-gray-500 font-medium">Terms of Service</span> and{' '}
            <span className="text-gray-500 font-medium">Privacy Policy</span>.
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-fizza-secondary font-semibold hover:text-fizza-primary transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
