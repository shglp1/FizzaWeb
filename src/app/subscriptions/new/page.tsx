'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { subscriptionService } from '@/services/subscriptionService';
import { riderService } from '@/services/riderService';

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

// ─── Quote breakdown card ─────────────────────────────────────────────────────

function QuoteBreakdown({ quote }: { quote: PriceQuote }) {
  return (
    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2 text-sm">
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
      <div className="flex justify-between text-gray-500 text-xs pl-2">
        <span>@ SAR {quote.pricePerKmSar}/km × {quote.chargeableDistanceKm} km</span>
      </div>
      {quote.extraRiderChargeSar > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">
            Extra rider{quote.extraRiderCount > 1 ? 's' : ''} ({quote.extraRiderCount} ×{' '}
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
        Route: {quote.normalizedPickupLabel} → {quote.normalizedDropoffLabel}
        <br />
        Distance via {quote.distanceProvider.replace('_', ' ').toLowerCase()}.
        {quote.tripDirection === 'ROUND_TRIP' && ' Round-trip counts both ways.'}
      </p>
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

  // ── Step 1: Rider, type & schedule ──
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
          <h2 className="font-semibold text-lg mb-1">Select Rider(s)</h2>
          <p className="text-xs text-gray-400 mb-3">
            You can select multiple riders for the same subscription. Extra riders are charged at 50% of the base price each.
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {riders.map((rider) => (
              <button
                key={rider.id}
                type="button"
                onClick={() => toggleRider(rider.id)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  selectedRiderIds.includes(rider.id)
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-emerald-300'
                }`}
              >
                <p className="font-semibold text-sm">{rider.name}</p>
                <p className="text-xs text-gray-400">
                  {rider.relationship}{rider.school ? ` · ${rider.school}` : ''}
                </p>
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

  // ── Step 2: Route + trip direction + price calculator ──
  const renderStep2 = () => (
    <div className="space-y-4">
      <h2 className="font-semibold text-lg mb-1">Route & Pricing</h2>
      <p className="text-sm text-gray-400">
        Enter your pickup and drop-off locations. The system will calculate the real road distance automatically.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location *</label>
        <input
          className="input"
          placeholder="e.g. Al-Nakheel District, Riyadh, Saudi Arabia"
          value={pickupLocation}
          onChange={(e) => setPickupLocation(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Drop-off Location *</label>
        <input
          className="input"
          placeholder="e.g. King Faisal School, Riyadh, Saudi Arabia"
          value={dropoffLocation}
          onChange={(e) => setDropoffLocation(e.target.value)}
        />
      </div>

      {/* Trip direction */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Trip Direction</label>
        <div className="flex gap-3">
          {([
            { value: 'ROUND_TRIP', label: '↔ Round Trip', hint: 'Distance counted both ways (recommended for school)' },
            { value: 'ONE_WAY', label: '→ One Way', hint: 'Distance counted once' },
          ] as { value: TripDirection; label: string; hint: string }[]).map(({ value, label, hint }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTripDirection(value)}
              className={`flex-1 p-3 rounded-xl border-2 text-left transition-all ${
                tripDirection === value
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-gray-200 hover:border-emerald-300'
              }`}
            >
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
            </button>
          ))}
        </div>
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

      {/* Calculate Price button */}
      <button
        type="button"
        onClick={handleCalculatePrice}
        disabled={quoteLoading}
        className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-emerald-500 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-60 transition-all"
      >
        {quoteLoading ? 'Calculating…' : quote ? '↻ Recalculate Price' : '⚡ Calculate Price'}
      </button>

      {quoteError && (
        <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{quoteError}</p>
      )}

      {quote && <QuoteBreakdown quote={quote} />}
    </div>
  );

  // ── Step 3: Preferences, Add-ons & confirmation ──
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
          {selectedAddOnIds.length > 0 && !quote && (
            <p className="text-xs text-amber-600 mt-2">
              You changed add-ons. Go back to Step 3 to recalculate the price.
            </p>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="card bg-gray-50 border-gray-200 space-y-1.5 text-sm">
        <p className="font-semibold text-gray-700 mb-2">Review Your Subscription</p>
        {selectedPackageId && (
          <p><span className="text-gray-400">Package:</span> {packages.find((p) => p.id === selectedPackageId)?.name}</p>
        )}
        <p><span className="text-gray-400">Type:</span> <span className="capitalize">{subscriptionType}</span></p>
        {selectedRiderIds.length > 0 && (
          <p>
            <span className="text-gray-400">Rider(s):</span>{' '}
            {selectedRiderIds.map((id) => riders.find((r) => r.id === id)?.name).join(', ')}
          </p>
        )}
        <p>
          <span className="text-gray-400">Route:</span> {pickupLocation} → {dropoffLocation}
          {' '}({tripDirection === 'ROUND_TRIP' ? 'Round-trip' : 'One-way'})
        </p>
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

      {quote ? (
        <QuoteBreakdown quote={quote} />
      ) : (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          Price not yet calculated. Please go back and click{' '}
          <strong>Calculate Price</strong> before confirming.
        </div>
      )}

      {submitError && (
        <p className="text-red-600 bg-red-50 rounded-xl px-4 py-3 text-sm">{submitError}</p>
      )}
    </div>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3];
  const isLastStep = step === TOTAL_STEPS - 1;
  const canConfirm = isLastStep && !!quote;

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
              disabled={submitting || !canConfirm}
              className="btn-primary flex-1 py-3 disabled:opacity-50"
              title={!quote ? 'Calculate price first' : undefined}
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
