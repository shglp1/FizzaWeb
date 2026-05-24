/** Map safety report categories to severity tiers for admin filters. */

import type { SafetyCategory } from '@/lib/validations/safety';

export type SafetySeverity = 'critical' | 'high' | 'medium' | 'low';

export const SAFETY_SEVERITY_LABELS: Record<SafetySeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const CATEGORY_SEVERITY: Record<SafetyCategory, SafetySeverity> = {
  HARASSMENT: 'critical',
  UNSAFE_DRIVING: 'high',
  ROUTE_DEVIATION: 'high',
  BEHAVIOUR: 'medium',
  VEHICLE_CONDITION: 'medium',
  LATE_PICKUP: 'low',
  OTHER: 'low',
};

export function getSafetySeverity(category: string): SafetySeverity {
  return CATEGORY_SEVERITY[category as SafetyCategory] ?? 'low';
}

export function categoriesForSeverity(severity: SafetySeverity): SafetyCategory[] {
  return (Object.entries(CATEGORY_SEVERITY) as [SafetyCategory, SafetySeverity][])
    .filter(([, s]) => s === severity)
    .map(([c]) => c);
}
