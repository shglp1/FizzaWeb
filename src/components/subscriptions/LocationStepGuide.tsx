'use client';

import { Check, MapPin } from 'lucide-react';

type Props = {
  pickupConfirmed: boolean;
  dropoffConfirmed: boolean;
  activeTarget: 'pickup' | 'dropoff' | null;
  language?: 'en' | 'ar';
};

const COPY = {
  en: {
    title: 'Set your route in two steps',
    subtitle: 'Confirm pickup first, then drop-off. Each stop gets its own map pin.',
    pickup: 'Pickup',
    dropoff: 'Drop-off',
    done: 'Confirmed',
    current: 'In progress',
    waiting: 'Up next',
    locked: 'Complete pickup first',
  },
  ar: {
    title: 'حدّد مسارك في خطوتين',
    subtitle: 'أكّد موقع الالتقاط أولاً، ثم موقع الوصول. لكل محطة دبوس على الخريطة.',
    pickup: 'الالتقاط',
    dropoff: 'الوصول',
    done: 'تم التأكيد',
    current: 'قيد الإعداد',
    waiting: 'التالي',
    locked: 'أكّد الالتقاط أولاً',
  },
};

function StepCard({
  step,
  label,
  status,
  statusLabel,
  isActive,
}: {
  step: number;
  label: string;
  status: 'done' | 'current' | 'waiting' | 'locked';
  statusLabel: string;
  isActive: boolean;
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border px-4 py-3 min-h-[56px] transition-all',
        status === 'done'
          ? 'border-emerald-200 bg-emerald-50/80'
          : isActive
            ? 'border-emerald-400 bg-white shadow-sm ring-2 ring-emerald-100'
            : status === 'locked'
              ? 'border-gray-100 bg-gray-50 opacity-70'
              : 'border-gray-200 bg-white',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          status === 'done'
            ? 'bg-emerald-500 text-white'
            : isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-500',
        ].join(' ')}
      >
        {status === 'done' ? <Check className="h-4 w-4" aria-hidden /> : step}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <MapPin
            className={`h-3.5 w-3.5 shrink-0 ${status === 'done' ? 'text-emerald-600' : 'text-gray-400'}`}
            aria-hidden
          />
          <p className="text-sm font-semibold text-gray-900">{label}</p>
        </div>
        <p
          className={[
            'text-xs mt-0.5',
            status === 'done' ? 'text-emerald-700' : isActive ? 'text-emerald-600' : 'text-gray-500',
          ].join(' ')}
        >
          {statusLabel}
        </p>
      </div>
    </div>
  );
}

export function LocationStepGuide({
  pickupConfirmed,
  dropoffConfirmed,
  activeTarget,
  language = 'en',
}: Props) {
  const c = COPY[language];

  const pickupStatus = pickupConfirmed ? 'done' : activeTarget === 'pickup' ? 'current' : 'waiting';
  const dropoffStatus = dropoffConfirmed
    ? 'done'
    : !pickupConfirmed
      ? 'locked'
      : activeTarget === 'dropoff'
        ? 'current'
        : 'waiting';

  const statusLabels = {
    done: c.done,
    current: c.current,
    waiting: c.waiting,
    locked: c.locked,
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{c.title}</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{c.subtitle}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <StepCard
          step={1}
          label={c.pickup}
          status={pickupStatus}
          statusLabel={statusLabels[pickupStatus]}
          isActive={activeTarget === 'pickup' && !pickupConfirmed}
        />
        <StepCard
          step={2}
          label={c.dropoff}
          status={dropoffStatus}
          statusLabel={statusLabels[dropoffStatus]}
          isActive={activeTarget === 'dropoff' && !dropoffConfirmed}
        />
      </div>
    </div>
  );
}
