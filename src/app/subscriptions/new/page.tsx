'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { subscriptionService } from '@/services/subscriptionService';
import { riderService } from '@/services/riderService';
import { walletService } from '@/services/walletService';
import { StableMapPicker } from '@/components/location/StableMapPicker';
import {
  fromSelectedLocation,
  subscriptionStepRequiresLocations,
  toSelectedLocation,
  type MapPickerLanguage,
  type SelectedLocation,
  type StableMapLocationValue,
} from '@/lib/location/stableMapPickerHelpers';
import {
  buildSubscriptionQuotePayload,
  mapQuoteValidationError,
} from '@/lib/subscriptions/quotePayload';

export type { SelectedLocation };
import {
  Alert,
  Button,
  Card,
  Input,
  LoadingState,
} from '@/components/ui';
import { FormSection, ActionBar, EnterpriseCard } from '@/components/ui/enterprise';
import { SubscriptionSummaryPanel } from '@/components/subscriptions/SubscriptionSummaryPanel';
import {
  SUBSCRIPTION_WIZARD_STEPS,
  SUBSCRIPTION_STEP_COPY,
  SUBSCRIPTION_WIZARD_STEP_COUNT,
} from '@/lib/ui/subscriptionWizard';
import { Check } from 'lucide-react';
import { mapDistanceProviderLabel } from '@/lib/ui/mapLocation';

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
  subtotalSar?: number;
  promoDiscountSar?: number;
  promo?: { code: string; partnerName: string | null; discountPercent: number } | null;
  loyaltyPointsUsed?: number;
  loyaltyDiscountSar?: number;
  loyalty?: {
    availablePoints: number;
    redemptionEnabled: boolean;
    pointsUsed: number;
    discountSar: number;
    remainingPoints: number;
    maxDiscountSar: number;
    maxRedeemablePoints: number;
    minimumPointsToRedeem: number;
    pointsPerSar: number;
  };
  finalPriceSar: number;
  // ── Meta ─────────────────────────────────────────────────────────────────────
  distanceProvider: string;
  distanceApproximate?: boolean;
  distanceWarning?: string | null;
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

const TOTAL_STEPS = SUBSCRIPTION_WIZARD_STEP_COUNT;

const STEP_META = SUBSCRIPTION_WIZARD_STEPS.map((label, i) => ({
  label,
  number: i + 1,
}));

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
  promoCode: string,
  loyaltyPoints: number,
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
    promoCode.trim().toUpperCase(),
    String(loyaltyPoints),
  ].join('|');
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <nav aria-label="Progress" className="mb-8 -mx-1 overflow-x-auto pb-1">
      <ol className="flex items-center gap-0 min-w-[520px] sm:min-w-0">
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
                    'text-[10px] sm:text-xs font-medium text-center max-w-[4.5rem] sm:max-w-none leading-tight',
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

      {(quote.promoDiscountSar ?? 0) > 0 && (
        <div className="flex justify-between text-emerald-700">
          <span>
            Promo {quote.promo?.code}
            {quote.promo?.discountPercent ? ` (${quote.promo.discountPercent}% off)` : ''}
          </span>
          <span className="font-medium">− SAR {quote.promoDiscountSar!.toFixed(2)}</span>
        </div>
      )}

      {(quote.loyaltyDiscountSar ?? 0) > 0 && (
        <div className="flex justify-between text-purple-700">
          <span>Loyalty points ({quote.loyaltyPointsUsed ?? 0} pts)</span>
          <span className="font-medium">− SAR {quote.loyaltyDiscountSar!.toFixed(2)}</span>
        </div>
      )}

      <div className="border-t border-emerald-200 pt-2 flex justify-between font-bold text-base">
        <span className="text-emerald-800">Total ({quote.billingCycle})</span>
        <span className="text-emerald-700">SAR {quote.finalPriceSar.toFixed(2)}</span>
      </div>

      <p className="text-xs text-gray-400 pt-1">
        Calculated via {mapDistanceProviderLabel(quote.distanceProvider, quote.distanceApproximate)}.
        {quote.distanceApproximate && (
          <span className="block text-amber-700 mt-1">
            {quote.distanceWarning ?? 'Approximate distance. Final price may be reviewed by admin.'}
          </span>
        )}
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
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState<string | null>(null);
  const [dropoffPhotoUrl, setDropoffPhotoUrl] = useState<string | null>(null);
  const [mapLanguage, setMapLanguage] = useState<MapPickerLanguage>('en');
  const [openMapPicker, setOpenMapPicker] = useState<'pickup' | 'dropoff' | null>('pickup');
  const [pickupTime, setPickupTime] = useState('07:00');
  const [returnTime, setReturnTime] = useState('15:00');
  const [femaleDriver, setFemaleDriver] = useState(false);
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState('');
  const [availableLoyaltyPoints, setAvailableLoyaltyPoints] = useState(0);

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
      walletService.getWallet(),
    ]).then(([pkgRes, addOnRes, riderRes, walletRes]) => {
      setPackages(pkgRes.data ?? []);
      setAddOns(addOnRes.data ?? []);
      setRiders((riderRes.data ?? []).filter((r: Rider) => r.isActive));
      if (typeof walletRes.data?.loyaltyPoints === 'number') {
        setAvailableLoyaltyPoints(walletRes.data.loyaltyPoints);
      }
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
    promoCode,
    Number(loyaltyPointsToRedeem) || 0,
  );

  useEffect(() => {
    if (quoteKey && currentQuoteKey !== quoteKey) {
      setQuote(null);
      setQuoteError('');
    }
  }, [currentQuoteKey, quoteKey]);

  useEffect(() => {
    if (step !== 2) return;
    if (!pickupLocation) setOpenMapPicker('pickup');
    else if (!dropoffLocation) setOpenMapPicker('dropoff');
    else setOpenMapPicker(null);
  }, [step, pickupLocation, dropoffLocation]);

  // ── Calculate Price ──
  const canCalculate =
    selectedRiderIds.length > 0 &&
    pickupLocation !== null &&
    dropoffLocation !== null;

  const handleCalculatePrice = useCallback(async () => {
    setQuoteError('');

    const built = buildSubscriptionQuotePayload({
      packageId: selectedPackageId,
      addOnIds: selectedAddOnIds,
      pickupLocation,
      dropoffLocation,
      tripDirection,
      riderIds: selectedRiderIds,
      weekdays,
      startsOn,
      promoCode,
      loyaltyPointsToRedeem: Number(loyaltyPointsToRedeem) || 0,
    });

    if (!built.ok) {
      setQuoteError(built.message);
      return;
    }

    setQuoteLoading(true);
    setQuote(null);

    try {
      const res = await fetch('/api/subscriptions/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.payload),
      });

      const json = await res.json();

      if (json.data?.quote) {
        setQuote(json.data.quote as PriceQuote);
        setQuoteKey(currentQuoteKey);
      } else {
        setQuoteError(
          mapQuoteValidationError(json.error?.message ?? 'Could not calculate price. Please try again.'),
        );
      }
    } catch {
      setQuoteError('Could not reach the pricing service. Check your connection and try again.');
    } finally {
      setQuoteLoading(false);
    }
  }, [
    pickupLocation, dropoffLocation, selectedRiderIds, selectedPackageId,
    selectedAddOnIds, tripDirection, weekdays, startsOn, currentQuoteKey, promoCode, loyaltyPointsToRedeem,
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
      if (weekdays.length === 0) { setStepError('Select at least one service day.'); return false; }
      if (selectedRiderIds.length === 0) { setStepError('Please select at least one rider.'); return false; }
      if (!pickupTime) { setStepError('Pickup time is required.'); return false; }
      if (tripDirection === 'ROUND_TRIP' && !returnTime) {
        setStepError('Return time is required for round-trip.');
        return false;
      }
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
    }
    if (step === 3) {
      if (!quote) { setStepError('Please calculate the price before continuing.'); return false; }
      if (quoteKey && currentQuoteKey !== quoteKey) {
        setStepError('Route or add-ons changed. Please recalculate price.');
        return false;
      }
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
      pickupPhotoUrl: pickupPhotoUrl ?? undefined,
      dropoffPhotoUrl: dropoffPhotoUrl ?? undefined,
      promoCode: promoCode.trim() || undefined,
      loyaltyPointsToRedeem: Number(loyaltyPointsToRedeem) || 0,
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

  const renderStep0 = () => (
    <FormSection
      title={SUBSCRIPTION_STEP_COPY[0]?.title ?? 'Choose your plan'}
      description={SUBSCRIPTION_STEP_COPY[0]?.description}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        {packages.map((pkg) => {
          const isSelected = selectedPackageId === pkg.id;
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedPackageId(isSelected ? null : pkg.id)}
              className={[
                'relative p-5 rounded-2xl border-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                isSelected
                  ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-white shadow-card-md ring-1 ring-emerald-100'
                  : 'border-gray-200 bg-white hover:border-emerald-300 hover:shadow-card',
              ].join(' ')}
            >
              {isSelected && (
                <Check className="absolute top-4 right-4 h-5 w-5 text-emerald-600" aria-hidden />
              )}
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide capitalize">{pkg.billingCycle}</p>
              <p className="font-bold text-lg text-gray-900 mt-1 pr-8">{pkg.name}</p>
              <p className="text-2xl font-bold text-emerald-700 mt-2">
                {Number(pkg.priceSar).toLocaleString()} <span className="text-sm font-medium text-gray-500">SAR</span>
              </p>
              {pkg.description && (
                <p className="text-sm text-gray-500 mt-3 leading-relaxed line-clamp-3">{pkg.description}</p>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelectedPackageId(null)}
          className={[
            'p-5 rounded-2xl border-2 border-dashed text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300',
            selectedPackageId === null
              ? 'border-gray-400 bg-gray-50'
              : 'border-gray-200 bg-white hover:border-gray-300',
          ].join(' ')}
        >
          <p className="font-semibold text-gray-700">Distance-based pricing</p>
          <p className="text-sm text-gray-500 mt-2">Skip a package — pay based on route distance and service days.</p>
        </button>
      </div>
    </FormSection>
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

      {/* Service day preview */}
      {weekdays.length > 0 && (
        <div className="rounded-xl bg-emerald-50/80 border border-emerald-100 px-4 py-3">
          <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">Service preview</p>
          <p className="text-sm text-gray-700 mt-1">
            Transport on{' '}
            <strong>{weekdays.map((d) => WEEKDAYS.find((w) => w.day === d)?.label).join(', ')}</strong>
            {offDays.length > 0 && (
              <span className="text-gray-500">
                {' '}(excluding {offDays.map((d) => WEEKDAYS.find((w) => w.day === d)?.label).join(', ')})
              </span>
            )}
          </p>
        </div>
      )}

      {/* Trip direction */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          Trip direction <span className="text-red-500">*</span>
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {([
            { value: 'ROUND_TRIP' as TripDirection, label: 'Round trip', hint: 'Morning pickup and afternoon return — most school plans' },
            { value: 'ONE_WAY' as TripDirection, label: 'One way', hint: 'Single direction each service day' },
          ]).map(({ value, label, hint }) => {
            const isActive = tripDirection === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTripDirection(value)}
                aria-pressed={isActive}
                className={[
                  'p-4 rounded-xl border-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                  isActive ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 bg-white hover:border-emerald-300',
                ].join(' ')}
              >
                <p className={`font-semibold text-sm ${isActive ? 'text-emerald-700' : 'text-gray-800'}`}>{label}</p>
                <p className="text-xs text-gray-500 mt-1">{hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Input label="Pickup time" required type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
        <Input
          label={tripDirection === 'ROUND_TRIP' ? 'Return time' : 'Return time (optional)'}
          required={tripDirection === 'ROUND_TRIP'}
          type="time"
          value={returnTime}
          onChange={(e) => setReturnTime(e.target.value)}
          helpText={tripDirection === 'ONE_WAY' ? 'Not used for one-way trips' : undefined}
        />
      </div>
    </div>
  );

  // ── Step 2: Pickup & drop-off (stable map picker) ──
  const renderStep2 = () => {
    const pickupStable = fromSelectedLocation(pickupLocation, pickupPhotoUrl);
    const dropoffStable = fromSelectedLocation(dropoffLocation, dropoffPhotoUrl);

    const confirmPickup = (v: StableMapLocationValue) => {
      setPickupLocation(toSelectedLocation(v));
      setPickupPhotoUrl(v.photoUrl ?? null);
      setOpenMapPicker('dropoff');
    };

    const confirmDropoff = (v: StableMapLocationValue) => {
      setDropoffLocation(toSelectedLocation(v));
      setDropoffPhotoUrl(v.photoUrl ?? null);
      setOpenMapPicker(null);
    };

    return (
      <div className="space-y-5 max-w-full overflow-x-hidden">
        <FormSection
          title={SUBSCRIPTION_STEP_COPY[2]?.title ?? 'Pickup & drop-off'}
          description="Search or use your current location, refine the pin on the map, then confirm each stop."
        >
          <div className="flex justify-end mb-3">
            <span className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button
                type="button"
                className={`px-3 py-1.5 min-h-[36px] ${mapLanguage === 'en' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`}
                onClick={() => setMapLanguage('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 min-h-[36px] ${mapLanguage === 'ar' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`}
                onClick={() => setMapLanguage('ar')}
              >
                AR
              </button>
            </span>
          </div>

          <div className="space-y-4">
            <StableMapPicker
              mode="pickup"
              language={mapLanguage}
              value={pickupStable}
              expanded={openMapPicker === 'pickup'}
              onExpand={() => setOpenMapPicker('pickup')}
              onConfirm={confirmPickup}
              onCancel={() => setOpenMapPicker(pickupStable ? null : 'pickup')}
              allowPhoto
              disabled={openMapPicker === 'dropoff'}
            />

            <StableMapPicker
              mode="dropoff"
              language={mapLanguage}
              value={dropoffStable}
              expanded={openMapPicker === 'dropoff'}
              onExpand={() => {
                if (pickupLocation) setOpenMapPicker('dropoff');
              }}
              onConfirm={confirmDropoff}
              onCancel={() => setOpenMapPicker(dropoffStable ? null : pickupLocation ? 'dropoff' : 'pickup')}
              allowPhoto
              disabled={!pickupLocation || openMapPicker === 'pickup'}
            />
          </div>

          {!subscriptionStepRequiresLocations(pickupStable, dropoffStable) && (
            <p className="text-xs text-amber-700 mt-4">
              Confirm both pickup and drop-off on the map to continue to pricing.
            </p>
          )}
        </FormSection>
      </div>
    );
  };

  // ── Step 3: Price & add-ons ──
  const renderStep3 = () => (
    <div className="space-y-6">
      <FormSection
        title={SUBSCRIPTION_STEP_COPY[3]?.title ?? 'Price & add-ons'}
        description="We calculate distance across all selected service days. Add optional extras, apply a promo code, then calculate your total."
      >
        <Input
          label="Promo code"
          placeholder="e.g. FAMOUS20 (optional)"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          helpText="Percentage discount applies before loyalty points"
        />

        {quote?.loyalty && (
          <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Loyalty points</p>
              <p className="text-sm text-gray-600 mt-1">
                You have <strong>{quote.loyalty.availablePoints}</strong> points available.
                Use points to reduce your subscription price.
              </p>
            </div>
            {!quote.loyalty.redemptionEnabled ? (
              <p className="text-sm text-amber-700">
                Redemption is not available yet — your balance is tracked for future rewards.
              </p>
            ) : quote.loyalty.availablePoints < quote.loyalty.minimumPointsToRedeem ? (
              <p className="text-sm text-amber-700">
                You need at least {quote.loyalty.minimumPointsToRedeem} points to redeem.
              </p>
            ) : (
              <>
                <Input
                  label="Points to redeem"
                  type="number"
                  min={0}
                  max={quote.loyalty.maxRedeemablePoints}
                  placeholder={`Min ${quote.loyalty.minimumPointsToRedeem}`}
                  value={loyaltyPointsToRedeem}
                  onChange={(e) => setLoyaltyPointsToRedeem(e.target.value.replace(/[^\d]/g, ''))}
                  helpText={`${quote.loyalty.pointsPerSar} points = SAR 1 · Max discount SAR ${quote.loyalty.maxDiscountSar.toFixed(2)}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLoyaltyPointsToRedeem(String(quote.loyalty!.maxRedeemablePoints))}
                >
                  Use maximum available
                </Button>
                {(quote.loyaltyPointsUsed ?? 0) > 0 && (
                  <p className="text-xs text-purple-800">
                    Using {quote.loyaltyPointsUsed} points → SAR {quote.loyaltyDiscountSar?.toFixed(2)} off ·{' '}
                    {quote.loyalty.remainingPoints} points remaining after payment
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {!quote?.loyalty && availableLoyaltyPoints > 0 && (
          <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Loyalty points</p>
            <p className="text-sm text-gray-600">
              You have <strong>{availableLoyaltyPoints}</strong> points. Enter points below, then calculate price.
            </p>
            <Input
              label="Points to redeem"
              type="number"
              min={0}
              value={loyaltyPointsToRedeem}
              onChange={(e) => setLoyaltyPointsToRedeem(e.target.value.replace(/[^\d]/g, ''))}
              helpText="Use points to reduce your subscription price (applied after promo discount)."
            />
          </div>
        )}

        <div className="relative group">
          <Button
            type="button"
            variant="primary"
            className="w-full"
            onClick={handleCalculatePrice}
            loading={quoteLoading}
            disabled={quoteLoading || !canCalculate}
          >
            {quoteLoading ? 'Calculating route distance and subscription price…' : quote ? 'Recalculate price' : 'Calculate price'}
          </Button>
          {!canCalculate && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Confirm pickup, drop-off, and riders on previous steps first.
            </p>
          )}
        </div>

        {quote && quoteKey && currentQuoteKey !== quoteKey && (
          <Alert variant="warning">Route or add-ons changed. Please recalculate before continuing.</Alert>
        )}
        {quoteError && <Alert variant="error">{quoteError}</Alert>}
        {quote && currentQuoteKey === quoteKey && <QuoteBreakdown quote={quote} />}
      </FormSection>

      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Preferences</h3>
        <label className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl cursor-pointer bg-white hover:bg-emerald-50/50 transition-colors">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 accent-emerald-600"
            checked={femaleDriver}
            onChange={(e) => setFemaleDriver(e.target.checked)}
          />
          <div>
            <p className="text-sm font-medium text-gray-700">Female driver preference</p>
            <p className="text-xs text-gray-500">We will try to match a female driver when available.</p>
          </div>
        </label>
      </div>

      {addOns.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Optional add-ons</h3>
          <p className="text-sm text-gray-500 mb-3">Tap to add extras to your plan.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {addOns.map((addon) => {
              const isSelected = selectedAddOnIds.includes(addon.id);
              return (
                <button
                  key={addon.id}
                  type="button"
                  onClick={() => toggleAddOn(addon.id)}
                  className={[
                    'relative text-left p-4 rounded-xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                    isSelected ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-200 bg-white hover:border-emerald-200',
                  ].join(' ')}
                >
                  {isSelected && (
                    <Check className="absolute top-3 right-3 h-4 w-4 text-emerald-600" aria-hidden />
                  )}
                  <p className="font-semibold text-sm text-gray-800 pr-6">{addon.name}</p>
                  <p className="text-sm font-bold text-emerald-700 mt-2">+{Number(addon.priceSar)} SAR</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ── Step 4: Review ──
  const renderStep4 = () => (
    <div className="space-y-6">
      <FormSection
        title={SUBSCRIPTION_STEP_COPY[4]?.title ?? 'Review & confirm'}
        description="Everything looks good? Confirm to create your subscription and proceed to payment."
      >
        <EnterpriseCard className="!shadow-none border-gray-200">
          <dl className="space-y-2 text-sm divide-y divide-gray-50">
            {selectedPackageId && (
              <div className="flex gap-2 py-2">
                <dt className="text-gray-500 w-28 shrink-0">Package</dt>
                <dd className="font-medium text-gray-900">{packages.find((p) => p.id === selectedPackageId)?.name}</dd>
              </div>
            )}
            <div className="flex gap-2 py-2">
              <dt className="text-gray-500 w-28 shrink-0">Type</dt>
              <dd className="font-medium text-gray-900 capitalize">{subscriptionType}</dd>
            </div>
            {selectedRiderIds.length > 0 && (
              <div className="flex gap-2 py-2">
                <dt className="text-gray-500 w-28 shrink-0">Riders</dt>
                <dd className="font-medium text-gray-900">
                  {selectedRiderIds.map((id) => riders.find((r) => r.id === id)?.name).join(', ')}
                </dd>
              </div>
            )}
            <div className="flex gap-2 py-2">
              <dt className="text-gray-500 w-28 shrink-0">Route</dt>
              <dd className="font-medium text-gray-900 leading-snug">
                {pickupLocation?.label ?? '—'} → {dropoffLocation?.label ?? '—'}
                <span className="block text-xs text-gray-500 font-normal mt-0.5">
                  {tripDirection === 'ROUND_TRIP' ? 'Round trip' : 'One way'}
                </span>
              </dd>
            </div>
            <div className="flex gap-2 py-2">
              <dt className="text-gray-500 w-28 shrink-0">Times</dt>
              <dd className="font-medium text-gray-900">
                {pickupTime} pickup{tripDirection === 'ROUND_TRIP' ? ` · ${returnTime} return` : ''}
              </dd>
            </div>
            <div className="flex gap-2 py-2">
              <dt className="text-gray-500 w-28 shrink-0">Days</dt>
              <dd className="font-medium text-gray-900">
                {weekdays.map((d) => WEEKDAYS.find((w) => w.day === d)?.label).join(', ')}
              </dd>
            </div>
            {selectedAddOnIds.length > 0 && (
              <div className="flex gap-2 py-2">
                <dt className="text-gray-500 w-28 shrink-0">Add-ons</dt>
                <dd className="font-medium text-gray-900">
                  {selectedAddOnIds.map((id) => addOns.find((a) => a.id === id)?.name).join(', ')}
                </dd>
              </div>
            )}
          </dl>
        </EnterpriseCard>
      </FormSection>

      {quote ? (
        <QuoteBreakdown quote={quote} />
      ) : (
        <Alert variant="warning">
          Price not calculated yet. Go back to the Price &amp; add-ons step and calculate your total.
          <button type="button" onClick={() => setStep(3)} className="block mt-2 text-sm font-semibold underline">
            Go to pricing step
          </button>
        </Alert>
      )}

      {submitError && <Alert variant="error">{submitError}</Alert>}
    </div>
  );

  const steps = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];
  const isLastStep = step === TOTAL_STEPS - 1;
  const canConfirm = isLastStep && !!quote;

  const summaryProps = {
    step,
    packageName: selectedPackageId ? packages.find((p) => p.id === selectedPackageId)?.name ?? null : null,
    riderNames: selectedRiderIds.map((id) => riders.find((r) => r.id === id)?.name).filter(Boolean) as string[],
    weekdaysLabel: weekdays.map((d) => WEEKDAYS.find((w) => w.day === d)?.label).filter(Boolean).join(', '),
    serviceDaysCount: quote?.actualServiceDays ?? 0,
    pickup: pickupLocation,
    dropoff: dropoffLocation,
    tripDirection,
    pickupTime,
    returnTime,
    addOnLabels: selectedAddOnIds.map((id) => addOns.find((a) => a.id === id)?.name).filter(Boolean) as string[],
    quote: quote && quoteKey === currentQuoteKey ? quote : null,
    quoteLoading,
  };

  return (
    <AppShell>
      <div className="mb-3">
        <Link
          href="/subscriptions"
          className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 hover:underline transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to subscriptions
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Create subscription</h1>
        <p className="text-sm text-gray-500 mt-1">Set up safe, scheduled transport for your family in a few steps.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8 items-start">
        <EnterpriseCard className="lg:col-span-2" padding="lg">
          <Stepper step={step} />

          {steps[step]?.()}

          {stepError && (
            <div className="mt-4">
              <Alert variant="error">{stepError}</Alert>
            </div>
          )}

          <ActionBar>
            {step > 0 && (
              <Button type="button" variant="outline" className="w-full sm:w-auto sm:flex-1" onClick={back}>
                Back
              </Button>
            )}
            {isLastStep ? (
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full sm:flex-1"
                onClick={handleSubmit}
                loading={submitting}
                disabled={submitting || !canConfirm}
              >
                {submitting ? 'Submitting…' : 'Confirm & continue to payment'}
              </Button>
            ) : (
              <Button type="button" variant="primary" size="lg" className="w-full sm:flex-1" onClick={next}>
                Continue
              </Button>
            )}
          </ActionBar>
        </EnterpriseCard>

        <div className="lg:col-span-1 space-y-4">
          <div className="hidden lg:block">
            <SubscriptionSummaryPanel {...summaryProps} />
          </div>
          <div className="lg:hidden">
            <details className="rounded-2xl border border-emerald-200 bg-emerald-50/30">
              <summary className="px-4 py-3 text-sm font-semibold text-emerald-800 cursor-pointer">
                View summary
              </summary>
              <div className="px-1 pb-2">
                <SubscriptionSummaryPanel {...summaryProps} compact />
              </div>
            </details>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
