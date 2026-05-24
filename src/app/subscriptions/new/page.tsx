'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { subscriptionService } from '@/services/subscriptionService';
import { riderService } from '@/services/riderService';
import { MapLocationPicker, type SelectedLocation } from '@/components/location/MapLocationPicker';
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
  // ── Distance ────────────────────────────────────────────────────────────────
  oneWayDistanceKm: number;
  dailyChargeableDistanceKm: number;
  totalChargeableDistanceKm: number;
  tripDirection: TripDirection;
  // ── Service days ─────────────────────────────────────────────────────────────
  weekdays: number[];
  actualServiceDays: number;
  serviceStartDate: string;
  serviceEndDate: string;
  billingCycle: string;
  // ── Price breakdown ──────────────────────────────────────────────────────────
  packagePriceSar: number;
  addOnsPriceSar: number;
  pricePerKmSar: number;
  distanceChargeSar: number;
  primaryFinalSar: number;
  extraRiderCount: number;
  extraRiderSameDropoffMultiplier: number;
  extraRiderChargeSar: number;
  finalPriceSar: number;
  // ── Meta ─────────────────────────────────────────────────────────────────────
  distanceProvider: string;
  normalizedPickupLabel: string;
  normalizedDropoffLabel: string;
  packageName: string | null;
  addOns: { id: string; name: string; priceSar: number }[];
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
  { label: 'Plan', number: 1 },
  { label: 'Rider & Schedule', number: 2 },
  { label: 'Pickup & Drop-off', number: 3 },
  { label: 'Review', number: 4 },
];

// ─── Quote key helper ─────────────────────────────────────────────────────────

function makeQuoteKey(
  packageId: string | null,
  addOnIds: string[],
  riderIds: string[],
  pickup: SelectedLocation | null,
  dropoff: SelectedLocation | null,
  direction: TripDirection,
  weekdays: number[],
  startsOn: string,
): string {
  return [
    packageId ?? '',
    [...addOnIds].sort().join(','),
    [...riderIds].sort().join(','),
    pickup ? `${pickup.latitude.toFixed(6)},${pickup.longitude.toFixed(6)}` : '',
    dropoff ? `${dropoff.latitude.toFixed(6)},${dropoff.longitude.toFixed(6)}` : '',
    direction,
    [...weekdays].sort().join(','),
    startsOn,
  ].join('|');
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center gap-0">
        {STEP_META.map((s, i) => {
          const isCompleted = i < step;
          const isCurrent = i === step;

          return (
            <li key={s.label} className="flex items-center flex-1 last:flex-none">
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

// ─── Day-of-week label helper ─────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Quote breakdown card ─────────────────────────────────────────────────────

function QuoteBreakdown({ quote }: { quote: PriceQuote }) {
  const dayLabels = quote.weekdays.map((d) => DAY_LABELS[d] ?? d).join(', ');

  return (
    <Card className="!bg-emerald-50 !border-emerald-200 space-y-2 text-sm">
      <p className="font-semibold text-emerald-800 text-base mb-3">Price Breakdown</p>

      {/* Route summary */}
      <div className="flex items-start gap-2 pb-3 border-b border-emerald-200">
        <div className="min-w-0 flex-1 text-xs text-gray-500 leading-relaxed">
          <span className="font-medium text-gray-700">{quote.normalizedPickupLabel}</span>
          <span className="mx-1.5 text-emerald-400">→</span>
          <span className="font-medium text-gray-700">{quote.normalizedDropoffLabel}</span>
        </div>
      </div>

      {/* Distance rows */}
      <div className="flex justify-between">
        <span className="text-gray-600">One-way distance</span>
        <span className="font-medium">{quote.oneWayDistanceKm} km</span>
      </div>

      <div className="flex justify-between">
        <span className="text-gray-600">Trip direction</span>
        <span className="font-medium">
          {quote.tripDirection === 'ROUND_TRIP' ? 'Round-trip (×2)' : 'One-way'}
        </span>
      </div>

      <div className="flex justify-between">
        <span className="text-gray-600">Daily chargeable distance</span>
        <span className="font-medium">{quote.dailyChargeableDistanceKm} km</span>
      </div>

      {/* Service days */}
      <div className="border-t border-emerald-100 pt-2 space-y-1.5">
        <div className="flex justify-between">
          <span className="text-gray-600">Schedule</span>
          <span className="font-medium text-right">{dayLabels}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Service period</span>
          <span className="font-medium text-xs text-right">
            {quote.serviceStartDate} → {quote.serviceEndDate}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 font-medium">Service days</span>
          <span className="font-bold text-emerald-700">{quote.actualServiceDays} days</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total chargeable distance</span>
          <span className="font-medium">
            {quote.totalChargeableDistanceKm} km
            <span className="ml-1 text-xs text-gray-400">
              ({quote.dailyChargeableDistanceKm} × {quote.actualServiceDays})
            </span>
          </span>
        </div>
      </div>

      {/* Price rows */}
      <div className="border-t border-emerald-100 pt-2">
        <div className="flex justify-between">
          <span className="text-gray-600">
            Distance charge
            <span className="ml-1 text-xs text-gray-400">
              ({quote.totalChargeableDistanceKm} km × SAR {quote.pricePerKmSar}/km)
            </span>
          </span>
          <span className="font-medium">SAR {quote.distanceChargeSar.toFixed(2)}</span>
        </div>
      </div>

      {quote.packagePriceSar > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">
            Package{quote.packageName ? ` (${quote.packageName})` : ''}
          </span>
          <span className="font-medium">SAR {quote.packagePriceSar.toFixed(2)}</span>
        </div>
      )}

      {quote.addOnsPriceSar > 0 && (
        <div className="flex justify-between">
          <span className="text-gray-600">
            Add-ons
            {quote.addOns.length > 0 && (
              <span className="ml-1 text-xs text-gray-400">
                ({quote.addOns.map((a) => a.name).join(', ')})
              </span>
            )}
          </span>
          <span className="font-medium">SAR {quote.addOnsPriceSar.toFixed(2)}</span>
        </div>
      )}

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
        <span className="text-emerald-800">Total ({quote.billingCycle})</span>
        <span className="text-emerald-700">SAR {quote.finalPriceSar.toFixed(2)}</span>
      </div>

      <p className="text-xs text-gray-400 pt-1">
        Calculated via {quote.distanceProvider.replace('_', ' ').toLowerCase()}.
        {quote.tripDirection === 'ROUND_TRIP' ? ' Round-trip counts both directions.' : ''}
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
  /** Pickup location — null until user selects from LocationPicker autocomplete. */
  const [pickupLocation, setPickupLocation] = useState<SelectedLocation | null>(null);
  /** Drop-off location — null until user selects from LocationPicker autocomplete. */
  const [dropoffLocation, setDropoffLocation] = useState<SelectedLocation | null>(null);
  const [pickupTime, setPickupTime] = useState('07:00');
  const [returnTime, setReturnTime] = useState('15:00');
  const [femaleDriver, setFemaleDriver] = useState(false);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);

  // ── Quote state ──
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  /** Snapshot of inputs at the time the last successful quote was fetched. */
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

  // ── Quote invalidation ──
  const currentQuoteKey = makeQuoteKey(
    selectedPackageId,
    selectedAddOnIds,
    selectedRiderIds,
    pickupLocation,
    dropoffLocation,
    tripDirection,
    weekdays,
    startsOn,
  );

  useEffect(() => {
    if (quoteKey && currentQuoteKey !== quoteKey) {
      setQuote(null);
      setQuoteError('');
    }
  }, [currentQuoteKey, quoteKey]);

  // ── Calculate Price ──
  const canCalculate =
    selectedRiderIds.length > 0 &&
    pickupLocation !== null &&
    dropoffLocation !== null;

  const handleCalculatePrice = useCallback(async () => {
    setQuoteError('');

    if (!pickupLocation) {
      setQuoteError('Please confirm the exact pickup pin on the map.');
      return;
    }
    if (!dropoffLocation) {
      setQuoteError('Please confirm the exact drop-off pin on the map.');
      return;
    }
    if (selectedRiderIds.length === 0) {
      setQuoteError('Please select at least one rider before calculating price.');
      return;
    }

    setQuoteLoading(true);
    setQuote(null);

    try {
      const res = await fetch('/api/subscriptions/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selectedPackageId ?? undefined,
          addOnIds: selectedAddOnIds,
          pickupLocation: {
            label: pickupLocation.label,
            latitude: pickupLocation.latitude,
            longitude: pickupLocation.longitude,
          },
          dropoffLocation: {
            label: dropoffLocation.label,
            latitude: dropoffLocation.latitude,
            longitude: dropoffLocation.longitude,
          },
          tripDirection,
          riderIds: selectedRiderIds,
          weekdays,
          startsOn: startsOn || undefined,
        }),
      });

      const json = await res.json();

      if (json.data?.quote) {
        setQuote(json.data.quote as PriceQuote);
        setQuoteKey(currentQuoteKey);
      } else {
        setQuoteError(json.error?.message ?? 'Could not calculate price. Please try again.');
      }
    } catch {
      setQuoteError('Could not reach the pricing service. Check your connection and try again.');
    } finally {
      setQuoteLoading(false);
    }
  }, [
    pickupLocation, dropoffLocation, selectedRiderIds, selectedPackageId,
    selectedAddOnIds, tripDirection, weekdays, startsOn, currentQuoteKey,
  ]);

  // ── Form helpers ──
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
      if (!pickupLocation) {
        setStepError('Please confirm the exact pickup pin on the map.');
        return false;
      }
      if (!dropoffLocation) {
        setStepError('Please confirm the exact drop-off pin on the map.');
        return false;
      }
      if (!pickupTime) { setStepError('Pickup time is required.'); return false; }
      if (tripDirection === 'ROUND_TRIP' && !returnTime) {
        setStepError('Return time is required for round-trip.');
        return false;
      }
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
    if (!pickupLocation || !dropoffLocation) {
      setSubmitError('Pickup and drop-off locations are required.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    const payload = {
      packageId: selectedPackageId ?? undefined,
      riderIds: selectedRiderIds.length > 0 ? selectedRiderIds : undefined,
      subscriptionType,
      // Send coordinate objects — the API recalculates price server-side
      pickupLocation: {
        label: pickupLocation.label,
        latitude: pickupLocation.latitude,
        longitude: pickupLocation.longitude,
      },
      dropoffLocation: {
        label: dropoffLocation.label,
        latitude: dropoffLocation.latitude,
        longitude: dropoffLocation.longitude,
      },
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

  // ── Step 2: Route + location picker + price calculator ──
  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <h2 className="font-semibold text-lg mb-1">Route &amp; Pricing</h2>
        <p className="text-sm text-gray-400">
          Search for and select your pickup and drop-off locations. The system will calculate the
          exact road distance automatically.
        </p>
      </div>

      {/* Location pickers */}
      <MapLocationPicker
        label="Pickup Location"
        value={pickupLocation}
        onChange={setPickupLocation}
        placeholder="e.g. Al-Nakheel District, Riyadh…"
        required
      />

      <MapLocationPicker
        label="Drop-off Location"
        value={dropoffLocation}
        onChange={setDropoffLocation}
        placeholder="e.g. King Faisal School, Riyadh…"
        required
      />

      {/* Trip direction */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Trip Direction <span className="text-red-500">*</span>
        </p>
        <div className="flex gap-3">
          {([
            { value: 'ROUND_TRIP', label: 'Round Trip', hint: 'Distance counted both ways — recommended for school' },
            { value: 'ONE_WAY', label: 'One Way', hint: 'Distance counted once' },
          ] as { value: TripDirection; label: string; hint: string }[]).map(({ value, label, hint }) => {
            const isActive = tripDirection === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTripDirection(value)}
                aria-pressed={isActive}
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
          label={tripDirection === 'ROUND_TRIP' ? 'Return Time' : 'Return Time (optional)'}
          required={tripDirection === 'ROUND_TRIP'}
          type="time"
          value={returnTime}
          onChange={(e) => setReturnTime(e.target.value)}
          helpText={tripDirection === 'ONE_WAY' ? 'Not required for one-way trips' : undefined}
        />
      </div>

      {/* Calculate Price button */}
      <div className="relative group">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleCalculatePrice}
          loading={quoteLoading}
          disabled={quoteLoading || !canCalculate}
          title={
            !canCalculate
              ? !pickupLocation
                ? 'Select a pickup location first'
                : !dropoffLocation
                ? 'Select a drop-off location first'
                : 'Select at least one rider first'
              : undefined
          }
        >
          {quoteLoading ? 'Calculating…' : quote ? 'Recalculate Price' : 'Calculate Price'}
        </Button>

        {/* Tooltip when disabled */}
        {!canCalculate && (
          <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden w-56 -translate-x-1/2 rounded-lg bg-gray-800 px-3 py-1.5 text-center text-xs text-white shadow-lg group-hover:block z-10">
            {!pickupLocation
              ? 'Select pickup location first'
              : !dropoffLocation
              ? 'Select drop-off location first'
              : 'Select at least one rider first'}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
          </div>
        )}
      </div>

      {/* Quote stale warning */}
      {quote && quoteKey && currentQuoteKey !== quoteKey && (
        <Alert variant="warning">
          Route or pricing changed. Please recalculate before confirming.
        </Alert>
      )}

      {quoteError && <Alert variant="error">{quoteError}</Alert>}

      {quote && currentQuoteKey === quoteKey && <QuoteBreakdown quote={quote} />}
    </div>
  );

  // ── Step 3: Preferences, Add-ons & Review ──
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
              <dd className="font-medium text-gray-700 leading-snug">
                {pickupLocation?.label ?? '—'} &rarr; {dropoffLocation?.label ?? '—'}{' '}
                <span className="text-gray-400 font-normal">
                  ({tripDirection === 'ROUND_TRIP' ? 'Round-trip' : 'One-way'})
                </span>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-400 w-24 shrink-0">Times</dt>
              <dd className="font-medium text-gray-700">
                {pickupTime} pickup{tripDirection === 'ROUND_TRIP' ? ` · ${returnTime} return` : ''}
              </dd>
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
        <Card className="!border-amber-200 !bg-amber-50">
          <div className="flex items-start gap-3">
            <svg className="shrink-0 text-amber-500 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Price not calculated yet</p>
              <p className="mt-1 text-sm text-amber-700">
                Please go back to Step 3, select your pickup and drop-off locations, and click{' '}
                <strong>Calculate Price</strong> before confirming.
              </p>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-2 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Go back and calculate price →
              </button>
            </div>
          </div>
        </Card>
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
                {submitting ? 'Submitting…' : 'Confirm Subscription'}
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
