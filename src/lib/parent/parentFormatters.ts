import type { TripStatus } from '../trips/tripLifecycle.ts';
import { isTrackableStatus } from '../trips/tripLifecycle.ts';

export function formatSarParent(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return `SAR ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}

export function formatTripDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-SA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDriverSummary(driver: {
  profile?: { fullName?: string | null; avatarUrl?: string | null } | null;
  rating?: number | string | null;
} | null | undefined): { name: string; rating: string; avatarUrl: string | null } {
  const name = driver?.profile?.fullName ?? 'Driver';
  const rating = driver?.rating != null ? Number(driver.rating).toFixed(1) : '—';
  return { name, rating, avatarUrl: driver?.profile?.avatarUrl ?? null };
}

export function formatVehicleSummary(vehicle: {
  model?: string | null;
  color?: string | null;
  plateNumber?: string | null;
  capacity?: number | null;
} | null | undefined): string {
  if (!vehicle) return 'Vehicle details pending';
  const parts = [vehicle.color, vehicle.model].filter(Boolean);
  if (vehicle.plateNumber) parts.push(vehicle.plateNumber);
  if (vehicle.capacity) parts.push(`${vehicle.capacity} seats`);
  return parts.join(' · ') || 'Vehicle assigned';
}

export type TrackingAvailability = 'available' | 'opens_soon' | 'not_yet' | 'unassigned' | 'closed';

export function getTrackingAvailability(
  status: TripStatus | string,
  scheduledPickupTime: string | null,
  hasDriver: boolean,
  chatOpenMinutes = 20,
): TrackingAvailability {
  if (!hasDriver) return 'unassigned';
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) return 'closed';
  if (isTrackableStatus(status as TripStatus)) return 'available';
  if (scheduledPickupTime) {
    const mins = (new Date(scheduledPickupTime).getTime() - Date.now()) / 60000;
    if (mins <= chatOpenMinutes) return 'opens_soon';
  }
  return 'not_yet';
}

export function trackingAvailabilityLabel(a: TrackingAvailability): string {
  switch (a) {
    case 'available': return 'Tracking available now';
    case 'opens_soon': return 'Opens soon';
    case 'not_yet': return 'Available before pickup';
    case 'unassigned': return 'Driver is being assigned';
    case 'closed': return 'Trip completed';
    default: return '';
  }
}

export function formatSubscriptionRoute(pickup: string, dropoff: string): string {
  const p = pickup.length > 40 ? `${pickup.slice(0, 40)}…` : pickup;
  const d = dropoff.length > 40 ? `${dropoff.slice(0, 40)}…` : dropoff;
  return `${p} → ${d}`;
}

export function formatServiceDays(schedules: { weekday: number; isOffDay: boolean }[]): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const active = schedules.filter((s) => !s.isOffDay).map((s) => labels[s.weekday]).filter(Boolean);
  return active.length ? active.join(', ') : '—';
}

export function groupTransactionsByDate<T extends { createdAt: string }>(
  items: T[],
): { date: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const date = new Date(item.createdAt).toLocaleDateString('en-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(item);
  }
  return [...map.entries()].map(([date, grouped]) => ({ date, items: grouped }));
}
