'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader, Card, Input, Textarea, Button, Alert, StatusBadge, LoadingState,
} from '@/components/ui';
import { driverApplicationService } from '@/services/driverApplicationService';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { DRIVER_APPLICATION_LOGIN_PATH } from '@/lib/driverAuthFlow';

// ─── Types ────────────────────────────────────────────────────────────────────

type VehicleType = 'ECONOMY' | 'COMFORT' | 'FAMILY' | 'VAN' | 'BUS' | 'PREMIUM';
type AppStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEEDS_CHANGES';

type Application = {
  id: string;
  status: AppStatus;
  vehicleType: VehicleType;
  vehicleCategory: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: number;
  plateNumber: string;
  vehicleColor: string;
  vehicleCapacity: number;
  licenseNumber: string;
  city: string;
  serviceArea: string;
  femaleDriver: boolean;
  driverNotes: string | null;
  adminResponse: string | null;
  submittedAt: string;
  resubmittedAt: string | null;
};

type FormValues = {
  vehicleBrand: string;
  vehicleModel: string;
  vehicleYear: string;
  plateNumber: string;
  vehicleColor: string;
  vehicleCapacity: string;
  licenseNumber: string;
  driverLicenseUrl: string;
  vehicleRegistrationUrl: string;
  nationalIdUrl: string;
  city: string;
  serviceArea: string;
  femaleDriver: boolean;
  driverNotes: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_TYPES: { type: VehicleType; label: string; emoji: string; seats: string }[] = [
  { type: 'ECONOMY', label: 'Economy',    emoji: '🚗', seats: 'Up to 4 seats' },
  { type: 'COMFORT', label: 'Comfort',    emoji: '🚙', seats: 'Up to 4 seats' },
  { type: 'FAMILY',  label: 'Family SUV', emoji: '🚐', seats: 'Up to 6 seats' },
  { type: 'VAN',     label: 'Van',        emoji: '🚌', seats: 'Up to 9 seats' },
  { type: 'BUS',     label: 'School Bus', emoji: '🚍', seats: 'Up to 30 seats' },
  { type: 'PREMIUM', label: 'Premium',    emoji: '✨', seats: 'Up to 4 seats' },
];

const STATUS_BADGE: Record<AppStatus, 'warning' | 'success' | 'danger' | 'orange'> = {
  PENDING:       'warning',
  APPROVED:      'success',
  REJECTED:      'danger',
  NEEDS_CHANGES: 'orange',
};

const STATUS_LABEL: Record<AppStatus, string> = {
  PENDING:       'Under Review',
  APPROVED:      'Approved',
  REJECTED:      'Rejected',
  NEEDS_CHANGES: 'Changes Needed',
};

// ─── Status tracker ───────────────────────────────────────────────────────────

const STEPS = [
  { key: 'submitted', label: 'Submitted',   icon: '📝' },
  { key: 'review',    label: 'Under Review', icon: '🔍' },
  { key: 'decision',  label: 'Decision',    icon: '✅' },
];

function StatusTracker({ status }: { status: AppStatus }) {
  const stepIndex = status === 'PENDING' ? 1 : 2;
  return (
    <div className="flex items-center gap-0 mb-4">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-base border-2 ${
              i <= stepIndex
                ? 'border-fizza-secondary bg-fizza-secondary/10'
                : 'border-gray-200 bg-white'
            }`}>
              {s.icon}
            </div>
            <p className={`text-xs mt-1 font-medium ${i <= stepIndex ? 'text-fizza-secondary' : 'text-gray-400'}`}>
              {s.label}
            </p>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mb-5 ${i < stepIndex ? 'bg-fizza-secondary' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Sign-in required (unauthenticated) ───────────────────────────────────────

function SignInRequiredCard() {
  return (
    <div className="min-h-screen bg-fizza-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center card-md p-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-3xl mb-5">
          🔐
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in to continue</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          You need a driver account to submit an application. Sign in or create an account
          through the Driver Portal.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={DRIVER_APPLICATION_LOGIN_PATH}
            className="inline-flex items-center justify-center rounded-xl bg-fizza-primary px-6 py-3 text-sm font-bold text-white hover:bg-emerald-800 transition-colors"
          >
            Sign in
          </a>
          <a
            href="/driver/register"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Create account
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Family-account forbidden card ───────────────────────────────────────────
// Shown when a normal PARENT/FAMILY account (not created via the driver portal)
// manually navigates to /driver-application.  Driver applications are only
// available through /drive → /driver/register.

function ForbiddenCard() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gray-100 text-5xl mb-6 mx-auto">
          🚫
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Driver applications are not available here
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed text-sm">
          Driver applications must be submitted through the dedicated Driver Portal.
          If you want to drive with Fizza, visit the driver portal to create a driver account.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/drive"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-fizza-primary px-6 py-3 text-sm font-bold text-white hover:bg-emerald-800 transition-colors shadow-sm"
          >
            Go to Driver Portal
          </a>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Approved state card ──────────────────────────────────────────────────────

function ApprovedCard() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-5xl mb-6 mx-auto">
          🎉
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Approved Driver
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Your application is approved!
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Congratulations — your driver account is fully activated.
          Head to your Driver Dashboard to see your assigned trips and get started.
        </p>
        <a
          href="/driver/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-fizza-primary px-8 py-3 text-sm font-bold text-white hover:bg-emerald-800 transition-colors shadow-sm"
        >
          Go to Driver Dashboard
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </a>
        <p className="text-xs text-gray-400 mt-4">
          If the Driver Dashboard is not available yet, please sign out and sign back in
          to activate your updated account.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriverApplicationPage() {
  const router = useRouter();
  const { user, loading: userLoading, isAuthenticated, isUnauthorized } = useCurrentUser();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading]           = useState(true);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState('');
  const [formSuccess, setFormSuccess]   = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const loadApplication = () => {
    setLoading(true);
    driverApplicationService.get().then((res) => {
      if (res.unauthorized) {
        setApplication(null);
        setLoading(false);
        router.replace(DRIVER_APPLICATION_LOGIN_PATH);
        return;
      }
      const data = res.data as { application?: Application | null } | undefined;
      const app: Application | null = data?.application ?? null;
      setApplication(app);
      if (app) {
        setSelectedType(app.vehicleType);
        reset({
          vehicleBrand:            app.vehicleBrand,
          vehicleModel:            app.vehicleModel,
          vehicleYear:             String(app.vehicleYear),
          plateNumber:             app.plateNumber,
          vehicleColor:            app.vehicleColor,
          vehicleCapacity:         String(app.vehicleCapacity),
          licenseNumber:           app.licenseNumber,
          city:                    app.city,
          serviceArea:             app.serviceArea,
          femaleDriver:            app.femaleDriver,
          driverNotes:             app.driverNotes ?? '',
          driverLicenseUrl:        '',
          vehicleRegistrationUrl:  '',
          nationalIdUrl:           '',
        });
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    if (userLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    loadApplication();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, isAuthenticated]);

  // Redirect unauthenticated users before they see the form
  useEffect(() => {
    if (!userLoading && isUnauthorized) {
      router.replace(DRIVER_APPLICATION_LOGIN_PATH);
    }
  }, [userLoading, isUnauthorized, router]);

  // Redirect approved drivers to their dashboard (middleware handles server-side;
  // this is a belt-and-suspenders client guard)
  useEffect(() => {
    if (!userLoading && user?.driverState === 'APPROVED_DRIVER') {
      router.replace('/driver/dashboard');
    }
  }, [user, userLoading, router]);

  const isEditable = !application || application.status === 'REJECTED' || application.status === 'NEEDS_CHANGES';

  const onSubmit = async (values: FormValues) => {
    if (!selectedType) { setFormError('Please select a vehicle type.'); return; }
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');
    const vehicleLabel = VEHICLE_TYPES.find((v) => v.type === selectedType)?.label ?? selectedType;
    const payload = {
      vehicleType:            selectedType,
      vehicleCategory:        vehicleLabel,
      vehicleBrand:           values.vehicleBrand,
      vehicleModel:           values.vehicleModel,
      vehicleYear:            parseInt(values.vehicleYear, 10),
      plateNumber:            values.plateNumber,
      vehicleColor:           values.vehicleColor,
      vehicleCapacity:        parseInt(values.vehicleCapacity, 10),
      licenseNumber:          values.licenseNumber,
      driverLicenseUrl:       values.driverLicenseUrl || undefined,
      vehicleRegistrationUrl: values.vehicleRegistrationUrl || undefined,
      nationalIdUrl:          values.nationalIdUrl || undefined,
      driverNotes:            values.driverNotes || undefined,
      city:                   values.city,
      serviceArea:            values.serviceArea,
      femaleDriver:           values.femaleDriver,
    };
    try {
      const res = application
        ? await driverApplicationService.resubmit(payload)
        : await driverApplicationService.submit(payload);
      if (res.unauthorized) {
        setFormError('Your session expired. Please sign in again.');
        router.push(DRIVER_APPLICATION_LOGIN_PATH);
        return;
      }
      const data = res.data as { application?: Application } | undefined;
      if (data?.application) {
        setFormSuccess('Application submitted successfully. We will review it shortly.');
        loadApplication();
      } else {
        setFormError(res.error?.message ?? 'Submission failed. Please try again.');
      }
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Unauthenticated — no form, no parent sidebar
  if (!userLoading && !isAuthenticated) {
    return <SignInRequiredCard />;
  }

  // Show loading while either user state or application is being fetched
  if (loading || userLoading) {
    return <AppShell><LoadingState message="Loading your application…" /></AppShell>;
  }

  const driverState = user?.driverState;
  const status = application?.status;

  // Normal PARENT/FAMILY account — must NOT access driver application
  if (driverState === 'PARENT') {
    return <AppShell><ForbiddenCard /></AppShell>;
  }

  // Approved state — APPROVED_DRIVER redirect was handled in useEffect above;
  // this covers the DRIVER_APPLICANT + APPROVED (JWT not yet refreshed) edge case
  if (status === 'APPROVED') {
    return <AppShell><ApprovedCard /></AppShell>;
  }

  return (
    <AppShell>
      {/* Back link */}
      <div className="mb-4">
        <a
          href="/drive"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Driver Portal
        </a>
      </div>

      <PageHeader
        title={status ? 'Driver Application' : 'Apply as a Driver'}
        subtitle={
          status
            ? 'Track your application status below'
            : 'Join the Fizza driver network — complete your application to get started'
        }
      />

      {/* ── Status card (existing application) ──────────────────────────── */}
      {application && status && (
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Application Status</h2>
            <StatusBadge variant={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</StatusBadge>
          </div>

          <StatusTracker status={status} />

          <div className="text-xs text-gray-400 mt-1">
            Submitted: {new Date(application.submittedAt).toLocaleDateString()}
            {application.resubmittedAt && (
              <> · Resubmitted: {new Date(application.resubmittedAt).toLocaleDateString()}</>
            )}
          </div>

          {/* Admin feedback */}
          {application.adminResponse && (
            <div className={`mt-3 rounded-xl px-3 py-2.5 border ${
              status === 'NEEDS_CHANGES'
                ? 'bg-amber-50 border-amber-100'
                : status === 'REJECTED'
                ? 'bg-red-50 border-red-100'
                : 'bg-gray-50 border-gray-100'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                status === 'NEEDS_CHANGES' ? 'text-amber-600'
                : status === 'REJECTED' ? 'text-red-600'
                : 'text-gray-500'
              }`}>
                {status === 'NEEDS_CHANGES' ? 'Changes Requested' : status === 'REJECTED' ? 'Rejection Reason' : 'Admin Notes'}
              </p>
              <p className="text-sm text-gray-800">{application.adminResponse}</p>
            </div>
          )}

          {/* State-specific guidance */}
          {status === 'PENDING' && (
            <div className="mt-3 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5 flex items-start gap-2">
              <span className="text-base shrink-0">🔍</span>
              <div>
                <p className="text-sm font-medium text-blue-800">Application under review</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Our team is reviewing your application. You will be notified once a decision is made.
                  This typically takes 1–3 business days.
                </p>
              </div>
            </div>
          )}
          {status === 'NEEDS_CHANGES' && (
            <Alert variant="warning" className="mt-3">
              The admin has requested changes. Please review the notes above and update your application below.
            </Alert>
          )}
          {status === 'REJECTED' && (
            <Alert variant="error" className="mt-3">
              Your application was not approved. You may update and resubmit your application below.
            </Alert>
          )}
        </Card>
      )}

      {/* ── Pending — read-only state, no form ───────────────────────────── */}
      {status === 'PENDING' && (
        <Card className="text-center py-10">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Your application is being reviewed</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            We will notify you once a decision is made. While you wait, make sure
            your profile information is up to date.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/profile"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Update Profile
            </a>
            <a
              href="/notifications"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              View Notifications
            </a>
          </div>
        </Card>
      )}

      {/* ── Application form (new, NEEDS_CHANGES, or REJECTED) ───────────── */}
      {isEditable && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* Vehicle type */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Vehicle Type <span className="text-red-500">*</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {VEHICLE_TYPES.map(({ type, label, emoji, seats }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setSelectedType(type); setFormError(''); }}
                  className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                    selectedType === type
                      ? 'border-fizza-secondary bg-emerald-50 shadow-sm'
                      : 'border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  {selectedType === type && (
                    <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-fizza-secondary">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                  <span className="text-2xl block mb-2">{emoji}</span>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{seats}</p>
                </button>
              ))}
            </div>
            {formError === 'Please select a vehicle type.' && (
              <Alert variant="error" className="mt-3">{formError}</Alert>
            )}
          </Card>

          {/* Vehicle details */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Vehicle Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Brand" placeholder="e.g. Toyota" required error={errors.vehicleBrand?.message}
                {...register('vehicleBrand', { required: 'Brand is required' })} />
              <Input label="Model" placeholder="e.g. Camry" required error={errors.vehicleModel?.message}
                {...register('vehicleModel', { required: 'Model is required' })} />
              <Input label="Year" type="number" placeholder="2022" required error={errors.vehicleYear?.message}
                {...register('vehicleYear', {
                  required: 'Year is required',
                  min: { value: 2000, message: 'Must be 2000 or later' },
                })} />
              <Input label="Color" placeholder="e.g. White" required error={errors.vehicleColor?.message}
                {...register('vehicleColor', { required: 'Color is required' })} />
              <Input label="Plate Number" placeholder="ABC-1234" required error={errors.plateNumber?.message}
                {...register('plateNumber', { required: 'Plate number is required' })} />
              <Input label="Passenger Capacity" type="number" placeholder="4" required error={errors.vehicleCapacity?.message}
                {...register('vehicleCapacity', {
                  required: 'Capacity is required',
                  min: { value: 1, message: 'At least 1' },
                })} />
            </div>
          </Card>

          {/* Driver details */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Driver Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Driver License Number" placeholder="DL-123456" required error={errors.licenseNumber?.message}
                {...register('licenseNumber', { required: 'License number is required' })} />
              <Input label="City" placeholder="e.g. Riyadh" required error={errors.city?.message}
                {...register('city', { required: 'City is required' })} />
              <div className="sm:col-span-2">
                <Input
                  label="Service Area"
                  placeholder="e.g. North Riyadh, Al-Nakheel District"
                  required
                  error={errors.serviceArea?.message}
                  {...register('serviceArea', { required: 'Service area is required' })}
                />
              </div>
              <div
                className="sm:col-span-2 flex items-start gap-3 px-3 py-3 rounded-xl border border-emerald-200 bg-emerald-50/30 cursor-pointer"
                onClick={() => {
                  const el = document.getElementById('femaleDriver') as HTMLInputElement;
                  if (el) el.click();
                }}
              >
                <input
                  id="femaleDriver"
                  type="checkbox"
                  className="w-4 h-4 mt-0.5 accent-fizza-secondary"
                  {...register('femaleDriver')}
                />
                <div>
                  <label htmlFor="femaleDriver" className="text-sm font-medium text-gray-800 cursor-pointer">
                    Female Driver
                  </label>
                  <p className="text-xs text-gray-500">Will be matched with families who prefer female drivers.</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Documents */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Documents</h2>
            <p className="text-sm text-gray-400 mb-4">Upload links to your documents (optional).</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Driver License URL" type="url" placeholder="https://…" {...register('driverLicenseUrl')} />
              <Input label="Vehicle Registration URL" type="url" placeholder="https://…" {...register('vehicleRegistrationUrl')} />
              <Input label="National ID URL" type="url" placeholder="https://…" {...register('nationalIdUrl')} />
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <Textarea
              label="Additional Notes"
              placeholder="Anything else you'd like us to know about your experience or availability…"
              rows={3}
              {...register('driverNotes')}
            />
          </Card>

          {formSuccess && (
            <Alert variant="success" onClose={() => setFormSuccess('')}>{formSuccess}</Alert>
          )}
          {formError && formError !== 'Please select a vehicle type.' && (
            <Alert variant="error" onClose={() => setFormError('')}>{formError}</Alert>
          )}

          <Button type="submit" variant="primary" size="lg" loading={submitting} className="w-full">
            {application ? 'Resubmit Application' : 'Submit Application'}
          </Button>
        </form>
      )}
    </AppShell>
  );
}
