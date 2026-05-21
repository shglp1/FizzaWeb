'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { driverApplicationService } from '@/services/driverApplicationService';

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

const VEHICLE_TYPES: { type: VehicleType; label: string; emoji: string; seats: string }[] = [
  { type: 'ECONOMY', label: 'Economy Car', emoji: '🚗', seats: 'Up to 4 seats' },
  { type: 'COMFORT', label: 'Comfort Car', emoji: '🚙', seats: 'Up to 4 seats' },
  { type: 'FAMILY', label: 'Family SUV', emoji: '🚐', seats: 'Up to 6 seats' },
  { type: 'VAN', label: 'Van', emoji: '🚌', seats: 'Up to 9 seats' },
  { type: 'BUS', label: 'School Bus', emoji: '🚍', seats: 'Up to 30 seats' },
  { type: 'PREMIUM', label: 'Premium Car', emoji: '✨', seats: 'Up to 4 seats' },
];

const STATUS_CONFIG: Record<AppStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING: { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  APPROVED: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  NEEDS_CHANGES: { label: 'Changes Needed', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
};

export default function DriverApplicationPage() {
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

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

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
      </AppShell>
    );
  }

  const status = application?.status;
  const statusCfg = status ? STATUS_CONFIG[status] : null;

  return (
    <AppShell>
      <div className="mb-2">
        <Link href="/profile" className="text-sm text-emerald-700 hover:underline">← Back to Profile</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Become a Driver</h1>

      {/* Status card */}
      {application && statusCfg && (
        <div className={`card mb-6 border ${statusCfg.border} ${statusCfg.bg}`}>
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-semibold ${statusCfg.color}`}>
              Application Status: {statusCfg.label}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            Submitted: {new Date(application.submittedAt).toLocaleDateString()}
            {application.resubmittedAt && (
              <> · Resubmitted: {new Date(application.resubmittedAt).toLocaleDateString()}</>
            )}
          </p>

          {application.adminResponse && (
            <div className="mt-3 p-3 bg-white rounded-xl border border-gray-200">
              <p className="text-xs text-gray-500 font-medium mb-1">Admin Notes:</p>
              <p className="text-sm text-gray-800">{application.adminResponse}</p>
            </div>
          )}

          {status === 'APPROVED' && (
            <p className="text-emerald-700 text-sm mt-2 font-medium">
              🎉 Congratulations! Your account has been upgraded to Driver.
            </p>
          )}
          {(status === 'REJECTED' || status === 'NEEDS_CHANGES') && (
            <p className="text-sm mt-2 text-gray-600">
              Please review the notes above and update your application below.
            </p>
          )}
        </div>
      )}

      {/* Form — hidden when APPROVED or PENDING */}
      {isEditable && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Vehicle type selector */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Select Vehicle Type</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {VEHICLE_TYPES.map(({ type, label, emoji, seats }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    selectedType === type
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                      : 'border-gray-200 hover:border-emerald-300'
                  }`}
                >
                  <span className="text-3xl block mb-2">{emoji}</span>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{seats}</p>
                </button>
              ))}
            </div>
            {!selectedType && formError && (
              <p className="text-red-500 text-xs mt-2">Please select a vehicle type.</p>
            )}
          </div>

          {/* Vehicle details */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Vehicle Details</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand *</label>
                <input className="input" placeholder="e.g. Toyota" {...register('vehicleBrand', { required: 'Brand is required' })} />
                {errors.vehicleBrand && <p className="text-red-500 text-xs mt-1">{errors.vehicleBrand.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                <input className="input" placeholder="e.g. Camry" {...register('vehicleModel', { required: 'Model is required' })} />
                {errors.vehicleModel && <p className="text-red-500 text-xs mt-1">{errors.vehicleModel.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year *</label>
                <input className="input" type="number" placeholder="2022" {...register('vehicleYear', { required: 'Year is required', min: { value: 2000, message: 'Must be 2000 or later' } })} />
                {errors.vehicleYear && <p className="text-red-500 text-xs mt-1">{errors.vehicleYear.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color *</label>
                <input className="input" placeholder="e.g. White" {...register('vehicleColor', { required: 'Color is required' })} />
                {errors.vehicleColor && <p className="text-red-500 text-xs mt-1">{errors.vehicleColor.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plate Number *</label>
                <input className="input" placeholder="ABC-1234" {...register('plateNumber', { required: 'Plate number is required' })} />
                {errors.plateNumber && <p className="text-red-500 text-xs mt-1">{errors.plateNumber.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Passenger Capacity *</label>
                <input className="input" type="number" placeholder="4" {...register('vehicleCapacity', { required: 'Capacity is required', min: { value: 1, message: 'At least 1' } })} />
                {errors.vehicleCapacity && <p className="text-red-500 text-xs mt-1">{errors.vehicleCapacity.message}</p>}
              </div>
            </div>
          </div>

          {/* Driver details */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Driver Details</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver License Number *</label>
                <input className="input" placeholder="DL-123456" {...register('licenseNumber', { required: 'License number is required' })} />
                {errors.licenseNumber && <p className="text-red-500 text-xs mt-1">{errors.licenseNumber.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input className="input" placeholder="e.g. Riyadh" {...register('city', { required: 'City is required' })} />
                {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Area *</label>
                <input className="input" placeholder="e.g. North Riyadh, Al-Nakheel District" {...register('serviceArea', { required: 'Service area is required' })} />
                {errors.serviceArea && <p className="text-red-500 text-xs mt-1">{errors.serviceArea.message}</p>}
              </div>
              <label className="flex items-center gap-2 px-3 py-3 border border-emerald-200 rounded-xl cursor-pointer">
                <input type="checkbox" {...register('femaleDriver')} className="w-4 h-4" />
                <span className="text-sm">Female driver (will be matched with families who prefer female drivers)</span>
              </label>
            </div>
          </div>

          {/* Documents (URL fields for now) */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-1">Documents</h2>
            <p className="text-sm text-gray-400 mb-4">Optional — upload URLs to your documents.</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver License URL</label>
                <input className="input" placeholder="https://…" {...register('driverLicenseUrl')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Registration URL</label>
                <input className="input" placeholder="https://…" {...register('vehicleRegistrationUrl')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">National ID URL</label>
                <input className="input" placeholder="https://…" {...register('nationalIdUrl')} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <h2 className="font-semibold text-lg mb-4">Additional Notes</h2>
            <textarea
              className="input h-24 resize-none"
              placeholder="Anything else you'd like us to know…"
              {...register('driverNotes')}
            />
          </div>

          {formSuccess && (
            <p className="text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 text-sm">{formSuccess}</p>
          )}
          {formError && !formError.includes('vehicle type') && (
            <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{formError}</p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
            {submitting
              ? 'Submitting…'
              : application
              ? 'Resubmit Application'
              : 'Submit Application'}
          </button>
        </form>
      )}

      {/* Pending — no editing allowed */}
      {status === 'PENDING' && (
        <div className="card text-center py-8">
          <p className="text-amber-700 font-medium mb-1">Your application is under review.</p>
          <p className="text-sm text-gray-500">
            We will notify you once a decision has been made. This usually takes 1–3 business days.
          </p>
        </div>
      )}
    </AppShell>
  );
}
