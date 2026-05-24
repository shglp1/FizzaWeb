/**
 * Subscription wizard step labels (Task 13) — used by UI and smoke tests.
 */
export const SUBSCRIPTION_WIZARD_STEPS = [
  'Plan',
  'Rider & Schedule',
  'Pickup & Drop-off',
  'Review',
] as const;

export const SUBSCRIPTION_WIZARD_STEP_COUNT = 4;

/** Maps 0-based step index to display label (4 steps; review is last). */
export function subscriptionStepLabel(stepIndex: number): string {
  const labels = ['Plan', 'Rider & Schedule', 'Pickup & Drop-off', 'Review'];
  return labels[stepIndex] ?? 'Step';
}
