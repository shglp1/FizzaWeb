'use client';

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

export default function DriverRegisterPage() {
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
    const res = await authService.register(
      values.email,
      values.password,
      values.fullName,
      values.phone,
    );
    if (res.data) {
      // New driver accounts start as PARENT role; go straight to the application form
      router.push('/driver-application');
    } else {
      setServerError(res.error?.message ?? 'Registration failed. Please try again.');
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
              Driver Portal — Step 1 of 2
            </span>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 mb-6 px-1">
            <div className="flex-1 flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-fizza-primary text-white flex items-center justify-center text-xs font-bold">1</div>
              <span className="text-[10px] text-fizza-primary font-semibold mt-1">Create Account</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200" />
            <div className="flex-1 flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-xs font-bold">2</div>
              <span className="text-[10px] text-gray-400 mt-1">Submit Application</span>
            </div>
          </div>

          <div className="card-md">
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900">Create driver account</h1>
              <p className="text-sm text-gray-500 mt-1">
                Step 1: create your account. You will fill in your vehicle details next.
              </p>
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
                placeholder="Mohammed Al-Rashid"
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
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
                })}
              />
              <Input
                label="Phone number"
                type="tel"
                autoComplete="tel"
                placeholder="+966 5X XXX XXXX"
                required
                error={errors.phone?.message}
                {...register('phone', {
                  required: 'Phone number is required',
                  minLength: { value: 9, message: 'Enter a valid phone number' },
                })}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                required
                error={errors.password?.message}
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'At least 8 characters' },
                })}
              />
              <Input
                label="Confirm password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
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
                className="w-full"
              >
                Continue to Application →
              </Button>
            </form>

            <div className="mt-5 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{' '}
                <a href="/driver/login" className="font-semibold text-fizza-secondary hover:underline">
                  Sign in
                </a>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">
              Looking for the family app?{' '}
              <a href="/register" className="text-gray-500 hover:text-gray-700 underline">
                Family registration
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
