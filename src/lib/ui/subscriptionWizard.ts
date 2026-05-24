/**
 * Subscription wizard — 5-step flow (Task 13.1).
 */
export const SUBSCRIPTION_WIZARD_STEPS = [
  'Plan',
  'Rider & Schedule',
  'Pickup & Drop-off',
  'Price & Add-ons',
  'Review',
] as const;

export const SUBSCRIPTION_WIZARD_STEP_COUNT = 5;

export const SUBSCRIPTION_STEP_COPY: { title: string; description: string }[] = [
  {
    title: 'Choose your plan',
    description: 'Select a monthly or annual package, or skip to use distance-based pricing.',
  },
  {
    title: 'Rider & schedule',
    description: 'Who is riding, which days, and what times fit your family routine.',
  },
  {
    title: 'Pickup & drop-off',
    description: 'Pin the exact locations on the map so we calculate the correct route distance.',
  },
  {
    title: 'Price & add-ons',
    description: 'Review your quote and optional extras before checkout.',
  },
  {
    title: 'Review & confirm',
    description: 'Double-check everything, then confirm to start your subscription.',
  },
];

export function subscriptionStepLabel(stepIndex: number): string {
  return SUBSCRIPTION_WIZARD_STEPS[stepIndex] ?? 'Step';
}
