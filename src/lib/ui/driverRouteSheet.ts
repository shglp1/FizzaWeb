/**
 * Driver route sheet grouping helpers (pure, testable).
 */

export type DriverTripTab =
  | 'today'
  | 'tomorrow'
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled';

export const DRIVER_ROUTE_TABS: DriverTripTab[] = [
  'today', 'tomorrow', 'upcoming', 'active', 'completed', 'cancelled',
];

export function groupTripsByDate<T extends { scheduledDate: string }>(
  trips: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const t of trips) {
    const key = t.scheduledDate.split('T')[0]!;
    const arr = map.get(key) ?? [];
    arr.push(t);
    map.set(key, arr);
  }
  return map;
}
