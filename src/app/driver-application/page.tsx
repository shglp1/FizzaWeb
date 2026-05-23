'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader,
  Card,
  Input,
  Textarea,
  Button,
  Alert,
  Badge,
  StatusBadge,
  LoadingState,
} from '@/components/ui';
import { driverApplicationService } from '@/services/driverApplicationService';

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
  { type: 'ECONOMY', label: 'Economy',     emoji: '🚗', seats: 'Up to 4 seats' },
  { type: 'COMFORT', label: 'Comfort',     emoji: '🚙', seats: 'Up to 4 seats' },
  { type: 'FAMILY',  label: 'Family SUV',  emoji: '🚐', seats: 'Up to 6 seats' },
  { type: 'VAN',     label: 'Van',         emoji: '🚌', seats: 'Up to 9 seats' },
  { type: 'BUS',     label: 'School Bus',  emoji: '🚍', seats: 'Up to 30 seats' },
  { type: 'PREMIUM', label: 'Premium',     emoji: '✨', seats: 'Up to 4 seats' },
];

const STATUS_BADGE: Record<AppStatus, 'warning' | 'success' | 'danger' | 'orange'> = {
  PENDING:      'warning',
  APPROVED:     'success',
  REJECTED:     'danger',
  NEEDS_CHANGES:'orange',
};

const STATUS_LABEL: Record<AppStatus, string> = {
  PENDING:       'Under Review',
  APPROVED:      'Approved',
  REJECTED:      'Rejected',
  NEEDS_CHANGES: 'Changes Needed',
};

// ─── Status tracker ───────────────────────────────────────────────────────────

const STEPS = [
  { key: 'submitted', label: 'Submitted', icon: '📝' },
  { key: 'review',    label: 'Under Review', icon: '🔍' },
  { key: 'decision',  label: 'Decision', icon: '✅' },
];

function StatusTracker({ status }: { status: AppStatus }) {
  const stepIndex = status === 'PENDING' ? 1 : 2;
  return (
    <div className="flex items-center gap-0 mb-4">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1">
          <div className={`flex flex-col items-center flex-1 ${i < STEPS.length - 1 ? '' : ''}`}>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriverApplicationPage() {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading]           = useState(true);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState('');
  const [formSuccess, setFormSuccess]   = useState('');

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const loadApplication = () => {
    driverApplicationService.get().then((res) => {
      const app: Application | null = res.data?.application ?? null;
      setApplication(app);
      if (app) {
        setSelectedType(app.vehicleType);
        reset({
          vehicleBrand: app.vehicleBrand,
          vehicleModel: app.vehicleModel,
          vehicleYear: String(app.vehicleYear),
          plateNumber: app.plateNumber,
          vehicleColor: app.vehicleColor,
          vehicleCapacity: String(app.vehicleCapacity),
          licenseNumber: app.licenseNumber,
          city: app.city,
          serviceArea: app.serviceArea,
          femaleDriver: app.femaleDriver,
          driverNotes: app.driverNotes ?? '',
        });
      }
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadApplication(); }, []);

  const isEditable = !application || application.status === 'REJECTED' || application.status === 'NEEDS_CHANGES';

  const onSubmit = async (values: FormValues) => {
    if (!selectedType) { setFormError('Please select a vehicle type.'); return; }
    setSubmitting(true);
    setFormError('');
    setFormSuccess('');
    const vehicleLabel = VEHICLE_TYPES.find((v) => v.type === selectedType)?.label ?? selectedType;
    const payload = {
      vehicleType: selectedType,
      vehicleCategory: vehicleLabel,
      vehicleBrand: values.vehicleBrand,
      vehicleModel: values.vehicleModel,
      vehicleYear: parseInt(values.vehicleYear, 10),
      plateNumber: values.plateNumber,
      vehicleColor: values.vehicleColor,
      vehicleCapacity: parseInt(values.vehicleCapacity, 10),
      licenseNumber: values.licenseNumber,
      driverLicenseUrl: values.driverLicenseUrl || undefined,
      vehicleRegistrationUrl: values.vehicleRegistrationUrl || undefined,
      nationalIdUrl: values.nationalIdUrl || undefined,
      driverNotes: values.driverNotes || undefined,
      city: values.city,
      serviceArea: values.serviceArea,
      femaleDriver: values.femaleDriver,
    };
    try {
      const res = application
        ? await driverApplicationService.resubmit(payload)
        : await driverApplicationService.submit(payload);
      if (res.data?.application) {
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

  if (loading) return <AppShell><LoadingState message="Loading your application…" /></AppShell>;

  const status = application?.status;

  return (
    <AppShell>
      <div className="mb-4">
        <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Profile
        </Link>
      </div>

      <PageHeader
        title="Become a Driver"
        subtitle="Apply to join the Fizza driver network and earn on your own schedule"
      />

      {/* Status card */}
      {application && status && (
        <Card className="mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Application Status</h2>
            <StatusBadge variant={STATUS_BADGE[status]}>
              {STATUS_LABEL[status]}
            </StatusBadge>
          </div>

          <StatusTracker status={status} />

          <div className="text-xs text-gray-400 mt-1">
            Submitted: {new Date(application.submittedAt).toLocaleDateString()}
            {application.resubmittedAt && (
              <> · Resubmitted: {new Date(application.resubmittedAt).toLocaleDateString()}</>
            )}
          </div>

          {application.adminResponse && (
            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Admin Notes</p>
              <p className="text-sm text-gray-800">{application.adminResponse}</p>
            </div>
          )}

          {status === 'APPROVED' && (
            <Alert variant="success" className="mt-3">
              🎉 Congratulations! Your account has been upgraded to Driver status.
            </Alert>
          )}
          {(status === 'REJECTED' || status === 'NEEDS_CHANGES') && (
            <Alert variant="warning" className="mt-3">
              Please review the admin notes above and update your application below.
            </Alert>
          )}
        </Card>
      )}

      {/* Pending — no form */}
      {status === 'PENDING' && (
        <Card className="text-center py-8">
          <div className="text-4xl mb-3">🔍</div>
          <p className="font-semibold text-gray-800 mb-1">Application Under Review</p>
          <p className="text-sm text-gray-500">
            We will notify you once a decision has been made. This usually takes 1–3 business days.
          </p>
        </Card>
      )}

      {/* Form */}
      {isEditable && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Vehicle type */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Vehicle Type <span className="text-red-500">*</span></h2>
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
                {...register('vehicleYear', { required: 'Year is required', min: { value: 2000, message: 'Must be 2000 or later' } })} />
              <Input label="Color" placeholder="e.g. White" required error={errors.vehicleColor?.message}
                {...register('vehicleColor', { required: 'Color is required' })} />
              <Input label="Plate Number" placeholder="ABC-1234" required error={errors.plateNumber?.message}
                {...register('plateNumber', { required: 'Plate number is required' })} />
              <Input label="Passenger Capacity" type="number" placeholder="4" required error={errors.vehicleCapacity?.message}
                {...register('vehicleCapacity', { required: 'Capacity is required', min: { value: 1, message: 'At least 1' } })} />
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
                <Input label="Service Area" placeholder="e.g. North Riyadh, Al-Nakheel District" required error={errors.serviceArea?.message}
                  {...register('serviceArea', { required: 'Service area is required' })} />
              </div>
              <div className="sm:col-span-2 flex items-start gap-3 px-3 py-3 rounded-xl border border-emerald-200 bg-emerald-50/30 cursor-pointer"
                onClick={() => {
                  const el = document.getElementById('femaleDriver') as HTMLInputElement;
                  if (el) el.click();
                }}
              >
                <input id="femaleDriver" type="checkbox" className="w-4 h-4 mt-0.5 accent-fizza-secondary" {...register('femaleDriver')} />
                <div>
                  <label htmlFor="femaleDriver" className="text-sm font-medium text-gray-800 cursor-pointer">Female Driver</label>
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
