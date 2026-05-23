'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { subscriptionService } from '@/services/subscriptionService';
import { riderService } from '@/services/riderService';
import {
  Alert,
  Button,
  Card,
  Input,
  LoadingState,
} from '@/components/ui';

// ─── Types ────────────────────────────────────────────────────────────────────

type Package = { id: string; name: string; billingCycle: string; priceSar: string; description: string | null };
type AddOn = { id: string; name: string; priceSar: string };
type Rider = { id: string; name: string; relationship: string; school: string | null; isActive: boolean };
type TripDirection = 'ONE_WAY' | 'ROUND_TRIP';

type PriceQuote = {
  packagePriceSar: number;
  addOnsPriceSar: number;
  oneWayDistanceKm: number;
  chargeableDistanceKm: number;
  tripDirection: TripDirection;
  pricePerKmSar: number;
  distanceChargeSar: number;
  primaryFinalSar: number;
  extraRiderCount: number;
  extraRiderSameDropoffMultiplier: number;
  extraRiderChargeSar: number;
  finalPriceSar: number;
  distanceProvider: string;
  normalizedPickupLabel: string;
  normalizedDropoffLabel: string;
};

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

const STEP_META = [
  { label: 'Package', number: 1 },
  { label: 'Schedule', number: 2 },
  { label: 'Route & Price', number: 3 },
  { label: 'Review', number: 4 },
];

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center gap-0">
        {STEP_META.map((s, i) => {
          const isCompleted = i < step;
          const isCurrent = i === step;
          const isUpcoming = i > step;

          return (
            <li key={s.label} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isCurrent
                      ? 'border-emerald-500 bg-white text-emerald-600 shadow-sm shadow-emerald-100'
                      : 'border-gray-200 bg-white text-gray-400',
                  ].join(' ')}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    s.number
                  )}
                </div>
                <span
                  className={[
                    'text-xs font-medium whitespace-nowrap',
                    isCurrent ? 'text-emerald-600' : isCompleted ? 'text-emerald-500' : 'text-gray-400',
                  ].join(' ')}
                >
                  {s.label}
                </span>
              </div>

              {/* Connector line between steps */}
              {i < STEP_META.length - 1 && (
                <div
                  className={[
                    'h-0.5 flex-1 mx-2 mb-5 rounded-full transition-colors',
                    isCompleted ? 'bg-emerald-400' : 'bg-gray-200',
                  ].join(' ')}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Quote breakdown card ─────────────────────────────────────────────────────

function QuoteBreakdown({ quote }: { quote: PriceQuote }) {
  return (
    <Card className="!bg-emerald-50 !border-emerald-200 space-y-2 text-sm">
      <p className="font-semibold text-emerald-800 text-base mb-3">Price Breakdown</p>

      <div className="flex justify-between">
        <span className="text-gray-600">Package</span>
        <span className="font-medium">SAR {quote.packagePriceSar.toFixed(2)}</span>
      </div>

      {quote.addOnsPriceSar > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">Add-ons</span>
          <span className="font-medium">SAR {quote.addOnsPriceSar.toFixed(2)}</span>
        </div>
      )}

      <div className="flex justify-between">
        <span className="text-gray-600">
          Distance ({quote.oneWayDistanceKm} km one-way
          {quote.tripDirection === 'ROUND_TRIP' ? `, ${quote.chargeableDistanceKm} km chargeable` : ''})
        </span>
        <span className="font-medium">SAR {quote.distanceChargeSar.toFixed(2)}</span>
      </div>
      <div className="flex text-gray-500 text-xs pl-2">
        <span>@ SAR {quote.pricePerKmSar}/km &times; {quote.chargeableDistanceKm} km</span>
      </div>

      {quote.extraRiderChargeSar > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">
            Extra rider{quote.extraRiderCount > 1 ? 's' : ''} ({quote.extraRiderCount} &times;{' '}
            {(quote.extraRiderSameDropoffMultiplier * 100).toFixed(0)}%)
          </span>
          <span className="font-medium">SAR {quote.extraRiderChargeSar.toFixed(2)}</span>
        </div>
      )}

      <div className="border-t border-emerald-200 pt-2 flex justify-between font-bold text-base">
        <span className="text-emerald-800">Total</span>
        <span className="text-emerald-700">SAR {quote.finalPriceSar.toFixed(2)}</span>
      </div>

      <p className="text-xs text-gray-400 pt-1">
        Route: {quote.normalizedPickupLabel} &rarr; {quote.normalizedDropoffLabel}
        <br />
        Distance via {quote.distanceProvider.replace('_', ' ').toLowerCase()}.
        {quote.tripDirection === 'ROUND_TRIP' && ' Round-trip counts both ways.'}
      </p>
    </Card>
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
  const [selectedRiderIds, setSelectedRiderIds] = useState<string[]>([]);
  const [tripDirection, setTripDirection] = useState<TripDirection>('ROUND_TRIP');
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

  // ── Quote state ──
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  /** Tracks inputs at quote-time so changes invalidate it */
  const [quoteKey, setQuoteKey] = useState('');

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

  // Invalidate quote whenever any pricing-relevant input changes
  const currentQuoteKey = [
    selectedPackageId ?? '',
    selectedAddOnIds.join(','),
    selectedRiderIds.join(','),
    pickupLocation.trim(),
    dropoffLocation.trim(),
    tripDirection,
  ].join('|');

  useEffect(() => {
    if (quoteKey && currentQuoteKey !== quoteKey) {
      setQuote(null);
      setQuoteError('');
    }
  }, [currentQuoteKey, quoteKey]);

  const handleCalculatePrice = useCallback(async () => {
    setQuoteError('');
    if (pickupLocation.trim().length < 5) {
      setQuoteError('Please enter a more detailed pickup location.');
      return;
    }
    if (dropoffLocation.trim().length < 5) {
      setQuoteError('Please enter a more detailed drop-off location.');
      return;
    }
    if (selectedRiderIds.length === 0) {
      setQuoteError('Please select at least one rider before calculating price.');
      return;
    }

    setQuoteLoading(true);
    setQuote(null);

    const res = await fetch('/api/subscriptions/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId: selectedPackageId ?? undefined,
        addOnIds: selectedAddOnIds,
        pickupLocation: pickupLocation.trim(),
        dropoffLocation: dropoffLocation.trim(),
        tripDirection,
        riderIds: selectedRiderIds,
      }),
    });

    const json = await res.json();
    setQuoteLoading(false);

    if (json.data?.quote) {
      setQuote(json.data.quote as PriceQuote);
      setQuoteKey(currentQuoteKey);
    } else {
      setQuoteError(json.error?.message ?? 'Could not calculate price. Please try again.');
    }
  }, [
    pickupLocation, dropoffLocation, selectedRiderIds, selectedPackageId,
    selectedAddOnIds, tripDirection, currentQuoteKey,
  ]);

  const toggleRider = (id: string) => {
    setSelectedRiderIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
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
      if (selectedRiderIds.length === 0) { setStepError('Please select at least one rider.'); return false; }
    }
    if (step === 2) {
      if (pickupLocation.trim().length < 5) { setStepError('Pickup location must be at least 5 characters.'); return false; }
      if (dropoffLocation.trim().length < 5) { setStepError('Dropoff location must be at least 5 characters.'); return false; }
      if (!pickupTime) { setStepError('Pickup time is required.'); return false; }
      if (!returnTime) { setStepError('Return time is required.'); return false; }
    }
    if (step === 3) {
      if (!quote) { setStepError('Please calculate the price before confirming.'); return false; }
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
    if (!quote) {
      setSubmitError('Please calculate the price first.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');

    const payload = {
      packageId: selectedPackageId ?? undefined,
      riderIds: selectedRiderIds.length > 0 ? selectedRiderIds : undefined,
      subscriptionType,
      pickupLocation: pickupLocation.trim(),
      dropoffLocation: dropoffLocation.trim(),
      tripDirection,
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
        <LoadingState message="Setting up your subscription form..." />
      </AppShell>
    );
  }

  // ── Step 0: Package selection ──
  const renderStep0 = () => (
    <div>
      <h2 className="font-semibold text-lg mb-1">Choose a Package</h2>
      <p className="text-sm text-gray-400 mb-5">Optional — you can skip if unsure.</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {packages.map((pkg) => {
          const isSelected = selectedPackageId === pkg.id;
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedPackageId(isSelected ? null : pkg.id)}
              className={[
                'relative p-4 rounded-2xl border-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                isSelected
                  ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-sm',
              ].join(' ')}
            >
              {/* Checkmark indicator */}
              {isSelected && (
                <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden="true">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}

              <p className="font-semibold text-sm text-gray-800 pr-6">{pkg.name}</p>
              <p className="text-emerald-700 font-bold text-base mt-1">
                {Number(pkg.priceSar).toLocaleString()} SAR
              </p>
              <p className="text-xs text-gray-400 mt-0.5 capitalize">{pkg.billingCycle}</p>
              {pkg.description && (
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{pkg.description}</p>
              )}
            </button>
          );
        })}

        {/* Skip option */}
        <button
          type="button"
          onClick={() => setSelectedPackageId(null)}
          className={[
            'p-4 rounded-2xl border-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300',
            selectedPackageId === null
              ? 'border-gray-400 bg-gray-50'
              : 'border-gray-200 bg-white hover:border-gray-300',
          ].join(' ')}
        >
          <p className="font-semibold text-sm text-gray-500">Skip for now</p>
          <p className="text-xs text-gray-400 mt-1">Select a package later</p>
        </button>
      </div>
    </div>
  );

  // ── Step 1: Rider, type & schedule ──
  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Subscription Type */}
      <div>
        <h2 className="font-semibold text-lg mb-3">Subscription Type</h2>
        <div className="flex gap-3">
          {(['school', 'university'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSubscriptionType(type)}
              className={[
                'flex-1 py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all capitalize focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                subscriptionType === type
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 text-gray-500 hover:border-emerald-300',
              ].join(' ')}
            >
              {type === 'school' ? 'School' : 'University'}
            </button>
          ))}
        </div>
      </div>

      {/* Riders */}
      {riders.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-1">Select Rider(s)</h2>
          <p className="text-xs text-gray-400 mb-3">
            You can select multiple riders for the same subscription. Extra riders are charged at 50% of the base price each.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {riders.map((rider) => {
              const isSelected = selectedRiderIds.includes(rider.id);
              return (
                <button
                  key={rider.id}
                  type="button"
                  onClick={() => toggleRider(rider.id)}
                  className={[
                    'relative p-3 rounded-xl border-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:border-emerald-300',
                  ].join(' ')}
                >
                  {/* Checkmark */}
                  {isSelected && (
                    <span className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden="true">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                  <p className="font-semibold text-sm text-gray-800 pr-6">{rider.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {rider.relationship}{rider.school ? ` · ${rider.school}` : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly Schedule */}
      <div>
        <h2 className="font-semibold text-lg mb-1">Weekly Schedule</h2>
        <p className="text-xs text-gray-400 mb-3">Select the days the rider needs transport.</p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map(({ day, label }) => {
            const isActive = weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleWeekday(day)}
                aria-pressed={isActive}
                className={[
                  'w-12 h-10 rounded-full border-2 font-semibold text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                  isActive
                    ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-emerald-300',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Off-days */}
      {weekdays.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Off-days <span className="font-normal text-gray-400">(optional)</span></p>
          <p className="text-xs text-gray-400 mb-3">Mark days within your schedule that are holidays or off-days.</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.filter(({ day }) => weekdays.includes(day)).map(({ day, label }) => {
              const isOff = offDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleOffDay(day)}
                  aria-pressed={isOff}
                  className={[
                    'w-12 h-10 rounded-full border-2 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300',
                    isOff
                      ? 'border-red-400 bg-red-50 text-red-600'
                      : 'border-gray-200 bg-white text-gray-400 hover:border-red-200',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Start Date + Auto-renewal */}
      <div className="grid sm:grid-cols-2 gap-3 items-end">
        <Input
          label="Start Date"
          type="date"
          value={startsOn}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setStartsOn(e.target.value)}
          helpText="Optional — leave blank to start immediately"
        />
        <label className="flex items-center gap-3 px-4 py-3 border border-emerald-200 rounded-xl cursor-pointer bg-white hover:bg-emerald-50 transition-colors mb-0.5">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-emerald-600 accent-emerald-600"
            checked={autoRenewal}
            onChange={(e) => setAutoRenewal(e.target.checked)}
          />
          <div>
            <p className="text-sm font-medium text-gray-700">Enable auto-renewal</p>
            <p className="text-xs text-gray-400">Subscription renews automatically</p>
          </div>
        </label>
      </div>
    </div>
  );

  // ── Step 2: Route + trip direction + price calculator ──
  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-lg mb-1">Route &amp; Pricing</h2>
        <p className="text-sm text-gray-400">
          Enter your pickup and drop-off locations. The system will calculate the real road distance automatically.
        </p>
      </div>

      <Input
        label="Pickup Location"
        required
        placeholder="e.g. Al-Nakheel District, Riyadh, Saudi Arabia"
        value={pickupLocation}
        onChange={(e) => setPickupLocation(e.target.value)}
      />

      <Input
        label="Drop-off Location"
        required
        placeholder="e.g. King Faisal School, Riyadh, Saudi Arabia"
        value={dropoffLocation}
        onChange={(e) => setDropoffLocation(e.target.value)}
      />

      {/* Trip direction */}
      <div>
        <p className="label mb-2">Trip Direction</p>
        <div className="flex gap-3">
          {([
            { value: 'ROUND_TRIP', label: 'Round Trip', hint: 'Distance counted both ways (recommended for school)' },
            { value: 'ONE_WAY', label: 'One Way', hint: 'Distance counted once' },
          ] as { value: TripDirection; label: string; hint: string }[]).map(({ value, label, hint }) => {
            const isActive = tripDirection === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTripDirection(value)}
                className={[
                  'flex-1 p-3 rounded-xl border-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                  isActive
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-emerald-300',
                ].join(' ')}
              >
                <p className={`font-semibold text-sm ${isActive ? 'text-emerald-700' : 'text-gray-700'}`}>{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Times */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Input
          label="Pickup Time"
          required
          type="time"
          value={pickupTime}
          onChange={(e) => setPickupTime(e.target.value)}
        />
        <Input
          label="Return Time"
          required
          type="time"
          value={returnTime}
          onChange={(e) => setReturnTime(e.target.value)}
        />
      </div>

      {/* Calculate Price button */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleCalculatePrice}
        loading={quoteLoading}
        disabled={quoteLoading}
      >
        {quoteLoading ? 'Calculating...' : quote ? 'Recalculate Price' : 'Calculate Price'}
      </Button>

      {quoteError && (
        <Alert variant="error">{quoteError}</Alert>
      )}

      {quote && <QuoteBreakdown quote={quote} />}
    </div>
  );

  // ── Step 3: Preferences, Add-ons & confirmation ──
  const renderStep3 = () => (
    <div className="space-y-6">
      {/* Preferences */}
      <div>
        <h2 className="font-semibold text-lg mb-3">Preferences</h2>
        <label className="flex items-center gap-3 px-4 py-3 border border-emerald-200 rounded-xl cursor-pointer bg-white hover:bg-emerald-50 transition-colors">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
            checked={femaleDriver}
            onChange={(e) => setFemaleDriver(e.target.checked)}
          />
          <div>
            <p className="text-sm font-medium text-gray-700">Female Driver Preference</p>
            <p className="text-xs text-gray-400">We will try to match your subscription with a female driver.</p>
          </div>
        </label>
      </div>

      {/* Add-ons */}
      {addOns.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-1">Add-ons</h2>
          <p className="text-sm text-gray-400 mb-3">Optional extras to enhance your subscription.</p>
          <div className="space-y-2">
            {addOns.map((addon) => {
              const isSelected = selectedAddOnIds.includes(addon.id);
              return (
                <label
                  key={addon.id}
                  className={[
                    'flex items-center gap-3 px-4 py-3 border-2 rounded-xl cursor-pointer transition-all',
                    isSelected
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:border-emerald-200',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 accent-emerald-600 shrink-0"
                    checked={isSelected}
                    onChange={() => toggleAddOn(addon.id)}
                  />
                  <p className="flex-1 text-sm font-medium text-gray-700">{addon.name}</p>
                  <span className="text-sm font-semibold text-emerald-700 shrink-0">
                    +{Number(addon.priceSar)} SAR
                  </span>
                </label>
              );
            })}
          </div>
          {selectedAddOnIds.length > 0 && !quote && (
            <div className="mt-3">
              <Alert variant="warning">
                You changed add-ons. Go back to Step 3 to recalculate the price.
              </Alert>
            </div>
          )}
        </div>
      )}

      {/* Review summary */}
      <div>
        <h2 className="font-semibold text-lg mb-3">Review Your Subscription</h2>
        <Card className="!bg-gray-50 !border-gray-200">
          <dl className="space-y-2 text-sm">
            {selectedPackageId && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-24 shrink-0">Package</dt>
                <dd className="font-medium text-gray-700">{packages.find((p) => p.id === selectedPackageId)?.name}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-400 w-24 shrink-0">Type</dt>
              <dd className="font-medium text-gray-700 capitalize">{subscriptionType}</dd>
            </div>
            {selectedRiderIds.length > 0 && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-24 shrink-0">Rider(s)</dt>
                <dd className="font-medium text-gray-700">
                  {selectedRiderIds.map((id) => riders.find((r) => r.id === id)?.name).join(', ')}
                </dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-400 w-24 shrink-0">Route</dt>
              <dd className="font-medium text-gray-700">
                {pickupLocation} &rarr; {dropoffLocation}{' '}
                <span className="text-gray-400 font-normal">({tripDirection === 'ROUND_TRIP' ? 'Round-trip' : 'One-way'})</span>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-400 w-24 shrink-0">Times</dt>
              <dd className="font-medium text-gray-700">{pickupTime} pickup &middot; {returnTime} return</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-400 w-24 shrink-0">Days</dt>
              <dd className="font-medium text-gray-700">
                {weekdays.map((d) => WEEKDAYS.find((w) => w.day === d)?.label).join(', ')}
              </dd>
            </div>
            {selectedAddOnIds.length > 0 && (
              <div className="flex gap-2">
                <dt className="text-gray-400 w-24 shrink-0">Add-ons</dt>
                <dd className="font-medium text-gray-700">
                  {selectedAddOnIds.map((id) => addOns.find((a) => a.id === id)?.name).join(', ')}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      {/* Quote or prompt */}
      {quote ? (
        <QuoteBreakdown quote={quote} />
      ) : (
        <Alert variant="warning">
          Price not yet calculated. Please go back and click <strong>Calculate Price</strong> before confirming.
        </Alert>
      )}

      {submitError && (
        <Alert variant="error">{submitError}</Alert>
      )}
    </div>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3];
  const isLastStep = step === TOTAL_STEPS - 1;
  const canConfirm = isLastStep && !!quote;

  return (
    <AppShell>
      {/* Back link */}
      <div className="mb-3">
        <Link
          href="/subscriptions"
          className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 hover:underline transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Subscriptions
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 mb-6">New Subscription</h1>

      <Card className="max-w-2xl">
        <Stepper step={step} />

        {steps[step]?.()}

        {stepError && (
          <div className="mt-4">
            <Alert variant="error">{stepError}</Alert>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-7 pt-5 border-t border-gray-100">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={back}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </Button>
          )}

          {isLastStep ? (
            <div className="flex-1 relative group">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleSubmit}
                loading={submitting}
                disabled={submitting || !canConfirm}
                title={!quote ? 'Calculate price first to confirm' : undefined}
              >
                {submitting ? 'Submitting...' : 'Confirm Subscription'}
              </Button>
              {!quote && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap shadow-lg">
                    Calculate price first
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={next}
            >
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Button>
          )}
        </div>
      </Card>
    </AppShell>
  );
}
