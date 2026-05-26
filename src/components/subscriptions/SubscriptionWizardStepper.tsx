'use client';

import { Check } from 'lucide-react';
import { SUBSCRIPTION_WIZARD_STEPS, subscriptionStepLabel } from '@/lib/ui/subscriptionWizard';

const STEP_COUNT = SUBSCRIPTION_WIZARD_STEPS.length;

export function SubscriptionWizardStepper({ step }: { step: number }) {
  const currentLabel = subscriptionStepLabel(step);
  const progress = ((step + 1) / STEP_COUNT) * 100;

  return (
    <nav aria-label="Progress" className="mb-6 sm:mb-8">
      {/* Mobile: compact progress */}
      <div className="sm:hidden space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
              Step {step + 1} of {STEP_COUNT}
            </p>
            <p className="text-base font-bold text-gray-900 truncate">{currentLabel}</p>
          </div>
          <span className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50 text-sm font-bold text-emerald-700">
            {step + 1}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden>
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="flex items-center justify-between gap-1 px-0.5">
          {SUBSCRIPTION_WIZARD_STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                    done
                      ? 'bg-emerald-500 text-white'
                      : current
                        ? 'border-2 border-emerald-500 bg-white text-emerald-600'
                        : 'bg-gray-100 text-gray-400',
                  ].join(' ')}
                  aria-current={current ? 'step' : undefined}
                  title={label}
                >
                  {done ? <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden /> : i + 1}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Desktop: full stepper */}
      <ol className="hidden sm:flex items-stretch gap-0">
        {SUBSCRIPTION_WIZARD_STEPS.map((label, i) => {
          const isCompleted = i < step;
          const isCurrent = i === step;

          return (
            <li key={label} className="flex items-center flex-1 last:flex-none min-w-0">
              <div className="flex flex-col items-center gap-1 min-w-0 w-full px-0.5">
                <div
                  className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-200/60'
                      : isCurrent
                        ? 'border-emerald-500 bg-white text-emerald-600 shadow-md shadow-emerald-100 ring-4 ring-emerald-50'
                        : 'border-gray-200 bg-gray-50 text-gray-400',
                  ].join(' ')}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={[
                    'text-[10px] font-semibold uppercase tracking-wide',
                    isCurrent ? 'text-emerald-600' : isCompleted ? 'text-emerald-500' : 'text-gray-400',
                  ].join(' ')}
                >
                  {isCompleted ? 'Done' : isCurrent ? 'Current' : 'Next'}
                </span>
                <span
                  className={[
                    'text-xs font-medium text-center leading-tight px-0.5',
                    isCurrent ? 'text-gray-900' : isCompleted ? 'text-gray-600' : 'text-gray-400',
                  ].join(' ')}
                >
                  {label}
                </span>
              </div>

              {i < STEP_COUNT - 1 && (
                <div
                  className={[
                    'h-0.5 flex-1 mx-2 mb-8 rounded-full transition-colors shrink',
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
