'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { subscriptionService } from '@/services/subscriptionService';
import { riderService } from '@/services/riderService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Package = { id: string; name: string; billingCycle: string; priceSar: string; description: string | null };
type AddOn = { id: string; name: string; priceSar: string };
type Rider = { id: string; name: string; relationship: string; school: string | null; isActive: boolean };

// 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
const WEEKDAYS = [
  { day: 0, label: 'Sun' },
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
];

const TOTAL_STEPS = 4;

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full transition-all ${
            i < step ? 'bg-emerald-500 flex-1' : i === step ? 'bg-emerald-300 flex-1' : 'bg-gray-200 flex-1'
          }`}
        />
      ))}
      <span className="text-xs text-gray-400 whitespace-nowrap">Step {step + 1}/{total}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NewSubscriptionPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [packages, setPackages] = useState<Package[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState('');
  const [submitError, setSubmitError] = useState('');

  // ── Form state ──
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [subscriptionType, setSubscriptionType] = useState<'school' | 'university'>('school');
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4]); // Sun-Thu default
  const [offDays, setOffDays] = useState<number[]>([]);
  const [startsOn, setStartsOn] = useState('');
  const [autoRenewal, setAutoRenewal] = useState(true);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [pickupTime, setPickupTime] = useState('07:00');
  const [returnTime, setReturnTime] = useState('15:00');
  const [femaleDriver, setFemaleDriver] = useState(false);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      subscriptionService.listPackages(),
      subscriptionService.listAddOns(),
      riderService.list(),
    ]).then(([pkgRes, addOnRes, riderRes]) => {
      setPackages(pkgRes.data ?? []);
      setAddOns(addOnRes.data ?? []);
      setRiders((riderRes.data ?? []).filter((r: Rider) => r.isActive));
      setLoading(false);
    });
  }, []);

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
    // If removing from weekdays, also remove from offDays
    setOffDays((prev) => prev.filter((d) => d !== day));
  };

  const toggleOffDay = (day: number) => {
    if (!weekdays.includes(day)) return;
    setOffDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const toggleAddOn = (id: string) => {
    setSelectedAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const validateStep = (): boolean => {
    setStepError('');
    if (step === 1) {
      if (weekdays.length === 0) { setStepError('Select at least one day.'); return false; }
    }
    if (step === 2) {
      if (pickupLocation.trim().length < 3) { setStepError('Pickup location must be at least 3 characters.'); return false; }
      if (dropoffLocation.trim().length < 3) { setStepError('Dropoff location must be at least 3 characters.'); return false; }
      if (!pickupTime) { setStepError('Pickup time is required.'); return false; }
      if (!returnTime) { setStepError('Return time is required.'); return false; }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError('');

    const payload = {
      packageId: selectedPackageId ?? undefined,
      riderId: selectedRiderId ?? undefined,
      subscriptionType,
      pickupLocation: pickupLocation.trim(),
      dropoffLocation: dropoffLocation.trim(),
      pickupTime,
      returnTime,
      weekdays,
      offDays,
      addOnIds: selectedAddOnIds,
      femaleDriverPreference: femaleDriver,
      autoRenewal,
      startsOn: startsOn || undefined,
    };

    const res = await subscriptionService.create(payload);
    setSubmitting(false);

    if (res.data) {
      router.push('/subscriptions');
    } else {
      setSubmitError(res.error?.message ?? 'Submission failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
      </AppShell>
    );
  }

  // ── Step 0: Package selection ──
  const renderStep0 = () => (
    <div>
      <h2 className="font-semibold text-lg mb-1">Choose a Package</h2>
      <p className="text-sm text-gray-400 mb-4">Optional — you can skip if unsure.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {packages.map((pkg) => (
          <button
            key={pkg.id}
            type="button"
            onClick={() => setSelectedPackageId(selectedPackageId === pkg.id ? null : pkg.id)}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              selectedPackageId === pkg.id
                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                : 'border-gray-200 hover:border-emerald-300'
            }`}
          >
            <p className="font-semibold text-sm">{pkg.name}</p>
            <p className="text-emerald-700 font-bold mt-1">
              {Number(pkg.priceSar).toLocaleString()} SAR
            </p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{pkg.billingCycle}</p>
            {pkg.description && (
              <p className="text-xs text-gray-500 mt-1">{pkg.description}</p>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelectedPackageId(null)}
          className={`p-4 rounded-2xl border-2 text-left transition-all ${
            selectedPackageId === null
              ? 'border-gray-400 bg-gray-50'
              : 'border-gray-200 hover:border-gray-400'
          }`}
        >
          <p className="font-semibold text-sm text-gray-500">Skip for now</p>
          <p className="text-xs text-gray-400 mt-1">Select a package later</p>
        </button>
      </div>
    </div>
  );

  // ── Step 1: Rider & Schedule ──
  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-lg mb-3">Subscription Type</h2>
        <div className="flex gap-3">
          {(['school', 'university'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSubscriptionType(type)}
              className={`flex-1 py-3 rounded-xl border-2 font-semibold text-sm transition-all capitalize ${
                subscriptionType === type
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 text-gray-500 hover:border-emerald-300'
              }`}
            >
              {type === 'school' ? '🏫 School' : '🎓 University'}
            </button>
          ))}
        </div>
      </div>

      {riders.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-3">Select Rider</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {riders.map((rider) => (
              <button
                key={rider.id}
                type="button"
                onClick={() => setSelectedRiderId(selectedRiderId === rider.id ? null : rider.id)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  selectedRiderId === rider.id
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-300'
                }`}
              >
                <p className="font-semibold text-sm">{rider.name}</p>
                <p className="text-xs text-gray-400">{rider.relationship}{rider.school ? ` · ${rider.school}` : ''}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-lg mb-2">Weekly Schedule</h2>
        <p className="text-xs text-gray-400 mb-3">Select the days the rider needs transport.</p>
        <div className="flex gap-2 flex-wrap">
          {WEEKDAYS.map(({ day, label }) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleWeekday(day)}
              className={`w-12 h-12 rounded-xl font-semibold text-sm border-2 transition-all ${
                weekdays.includes(day)
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-gray-200 text-gray-500 hover:border-emerald-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {weekdays.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Mark off-days (optional)</p>
          <div className="flex gap-2 flex-wrap">
            {WEEKDAYS.filter(({ day }) => weekdays.includes(day)).map(({ day, label }) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleOffDay(day)}
                className={`w-12 h-12 rounded-xl text-sm border-2 transition-all ${
                  offDays.includes(day)
                    ? 'border-red-400 bg-red-50 text-red-600'
                    : 'border-gray-200 text-gray-400 hover:border-red-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date (optional)</label>
          <input
            type="date"
            className="input"
            value={startsOn}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 px-3 py-3 border border-emerald-200 rounded-xl cursor-pointer self-end">
          <input
            type="checkbox"
            className="w-4 h-4"
            checked={autoRenewal}
            onChange={(e) => setAutoRenewal(e.target.checked)}
          />
          <span className="text-sm">Enable auto-renewal</span>
        </label>
      </div>
    </div>
  );

  // ── Step 2: Route ──
  const renderStep2 = () => (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg mb-1">Route Details</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location *</label>
        <input
          className="input"
          placeholder="e.g. Home — Al-Nakheel District, Riyadh"
          value={pickupLocation}
          onChange={(e) => setPickupLocation(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dropoff Location *</label>
        <input
          className="input"
          placeholder="e.g. King Faisal School"
          value={dropoffLocation}
          onChange={(e) => setDropoffLocation(e.target.value)}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Time *</label>
          <input
            type="time"
            className="input"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Return Time *</label>
          <input
            type="time"
            className="input"
            value={returnTime}
            onChange={(e) => setReturnTime(e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  // ── Step 3: Preferences & Add-ons ──
  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-lg mb-3">Preferences</h2>
        <label className="flex items-center gap-3 px-4 py-3 border border-emerald-200 rounded-xl cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4"
            checked={femaleDriver}
            onChange={(e) => setFemaleDriver(e.target.checked)}
          />
          <div>
            <p className="text-sm font-medium">Female Driver Preference</p>
            <p className="text-xs text-gray-400">We will try to match your subscription with a female driver.</p>
          </div>
        </label>
      </div>

      {addOns.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-1">Add-ons</h2>
          <p className="text-sm text-gray-400 mb-3">Optional extras to enhance your subscription.</p>
          <div className="space-y-2">
            {addOns.map((addon) => (
              <label
                key={addon.id}
                className={`flex items-center gap-3 px-4 py-3 border-2 rounded-xl cursor-pointer transition-all ${
                  selectedAddOnIds.includes(addon.id)
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-200'
                }`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={selectedAddOnIds.includes(addon.id)}
                  onChange={() => toggleAddOn(addon.id)}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{addon.name}</p>
                </div>
                <span className="text-sm font-semibold text-emerald-700">
                  +{Number(addon.priceSar)} SAR
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="card bg-gray-50 border-gray-200 space-y-1.5 text-sm">
        <p className="font-semibold text-gray-700 mb-2">Review Your Subscription</p>
        {selectedPackageId && (
          <p><span className="text-gray-400">Package:</span> {packages.find((p) => p.id === selectedPackageId)?.name}</p>
        )}
        <p><span className="text-gray-400">Type:</span> <span className="capitalize">{subscriptionType}</span></p>
        {selectedRiderId && (
          <p><span className="text-gray-400">Rider:</span> {riders.find((r) => r.id === selectedRiderId)?.name}</p>
        )}
        <p><span className="text-gray-400">Route:</span> {pickupLocation} → {dropoffLocation}</p>
        <p><span className="text-gray-400">Times:</span> {pickupTime} pickup · {returnTime} return</p>
        <p>
          <span className="text-gray-400">Days:</span>{' '}
          {weekdays.map((d) => WEEKDAYS.find((w) => w.day === d)?.label).join(', ')}
        </p>
        {selectedAddOnIds.length > 0 && (
          <p>
            <span className="text-gray-400">Add-ons:</span>{' '}
            {selectedAddOnIds.map((id) => addOns.find((a) => a.id === id)?.name).join(', ')}
          </p>
        )}
      </div>

      {submitError && (
        <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{submitError}</p>
      )}
    </div>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3];
  const isLastStep = step === TOTAL_STEPS - 1;

  return (
    <AppShell>
      <div className="mb-2">
        <Link href="/subscriptions" className="text-sm text-emerald-700 hover:underline">
          ← Back to Subscriptions
        </Link>
      </div>
      <h1 className="text-2xl font-semibold mb-6">New Subscription</h1>

      <div className="card max-w-2xl">
        <StepDots step={step} total={TOTAL_STEPS} />

        {steps[step]?.()}

        {stepError && (
          <p className="text-red-600 text-sm mt-3">{stepError}</p>
        )}

        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button type="button" onClick={back} className="btn-outline flex-1 py-3">
              ← Back
            </button>
          )}
          {isLastStep ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex-1 py-3"
            >
              {submitting ? 'Submitting…' : 'Confirm Subscription'}
            </button>
          ) : (
            <button type="button" onClick={next} className="btn-primary flex-1 py-3">
              Next →
            </button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
