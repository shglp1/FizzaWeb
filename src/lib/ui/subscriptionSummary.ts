/** Format subscription route/schedule summaries for admin list UI. */

const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

type ScheduleRow = { weekday: number; isOffDay: boolean };

type SubscriptionSummaryInput = {
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  normalizedPickupLabel?: string | null;
  normalizedDropoffLabel?: string | null;
  tripDirection?: string | null;
  pickupTime?: string | null;
  returnTime?: string | null;
  startsOn?: string | Date | null;
  endsOn?: string | Date | null;
  actualServiceDays?: number | null;
  schedules?: ScheduleRow[];
};

export function formatRouteSummary(sub: SubscriptionSummaryInput): string {
  const pickup = sub.normalizedPickupLabel ?? sub.pickupLocation ?? '—';
  const dropoff = sub.normalizedDropoffLabel ?? sub.dropoffLocation ?? '—';
  return `${pickup} → ${dropoff}`;
}

export function formatScheduleSummary(sub: SubscriptionSummaryInput): string {
  const parts: string[] = [];
  if (sub.pickupTime) parts.push(`Pickup ${sub.pickupTime}`);
  if (sub.returnTime && sub.tripDirection === 'ROUND_TRIP') parts.push(`Return ${sub.returnTime}`);
  if (sub.tripDirection) parts.push(sub.tripDirection === 'ROUND_TRIP' ? 'Round trip' : 'One way');
  return parts.length > 0 ? parts.join(' · ') : '—';
}

export function formatServiceDaysSummary(sub: SubscriptionSummaryInput): string {
  const activeDays = (sub.schedules ?? [])
    .filter((s) => !s.isOffDay)
    .map((s) => WEEKDAY_LABELS[s.weekday] ?? String(s.weekday))
    .join(', ');
  const daysPart = activeDays ? activeDays : '—';
  if (sub.actualServiceDays != null) {
    return `${daysPart} (${sub.actualServiceDays} service days)`;
  }
  return daysPart;
}

export function formatServicePeriod(sub: SubscriptionSummaryInput): string {
  const start = sub.startsOn ? new Date(sub.startsOn).toLocaleDateString('en-SA') : null;
  const end = sub.endsOn ? new Date(sub.endsOn).toLocaleDateString('en-SA') : null;
  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  return '—';
}
