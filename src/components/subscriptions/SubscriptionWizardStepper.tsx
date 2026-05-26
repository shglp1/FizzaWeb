'use client';

import { Check } from 'lucide-react';
import { SUBSCRIPTION_WIZARD_STEPS } from '@/lib/ui/subscriptionWizard';

const STEP_META = SUBSCRIPTION_WIZARD_STEPS.map((label, i) => ({
  label,
  number: i + 1,
}));

type StepState = 'completed' | 'current' | 'upcoming';

function stepState(index: number, current: number): StepState {
  if (index < current) return 'completed';
  if (index === current) return 'current';
  return 'upcoming';
}

const STATE_LABEL: Record<StepState, string> = {
  completed: 'Completed',
  current: 'Current',
  upcoming: 'Upcoming',
};

export function SubscriptionWizardStepper({ step }: { step: number }) {
  return (
    <nav aria-label="Progress" className="mb-8 -mx-1 overflow-x-auto pb-1">
      <ol className="flex items-stretch gap-0 min-w-[560px] sm:min-w-0">
        {STEP_META.map((s, i) => {
          const state = stepState(i, step);
          const isCompleted = state === 'completed';
          const isCurrent = state === 'current';

          return (
            <li key={s.label} className="flex items-center flex-1 last:flex-none min-w-0">
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
                    s.number
                  )}
                </div>
                <span
                  className={[
                    'text-[10px] sm:text-xs font-semibold uppercase tracking-wide',
                    isCurrent ? 'text-emerald-600' : isCompleted ? 'text-emerald-500' : 'text-gray-400',
                  ].join(' ')}
                >
                  {STATE_LABEL[state]}
                </span>
                <span
                  className={[
                    'text-[10px] sm:text-xs font-medium text-center max-w-[4.5rem] sm:max-w-none leading-tight',
                    isCurrent ? 'text-gray-900' : isCompleted ? 'text-gray-600' : 'text-gray-400',
                  ].join(' ')}
                >
                  {s.label}
                </span>
              </div>

              {i < STEP_META.length - 1 && (
                <div
                  className={[
                    'h-0.5 flex-1 mx-1 sm:mx-2 mb-8 rounded-full transition-colors shrink',
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
