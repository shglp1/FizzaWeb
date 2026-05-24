/** Pure helpers for Admin Trips UI — formatters, filters, labels (testable). */

export type GenerateTripsResult = {
  generatedCount?: number;
  confirmedCount?: number;
  needsDispatchCount?: number;
  skippedCount?: number;
  failedCount?: number;
  startDate?: string;
  endDate?: string;
};

export type TripFilterPreset = '' | 'needs_dispatch' | 'unassigned' | 'active' | 'completed' | 'cancelled';

export function formatLegType(legType?: string | null): string {
  if (legType === 'RETURN') return 'Return';
  if (legType === 'OUTBOUND') return 'Outbound';
  return 'Trip';
}

export function truncateRouteLabel(label: string, max = 42): string {
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function formatRouteSummary(pickup: string, dropoff: string, max = 38): string {
  return `${truncateRouteLabel(pickup, max)} → ${truncateRouteLabel(dropoff, max)}`;
}

export function formatDispatchNoteSummary(note: string | null | undefined, max = 90): string {
  if (!note?.trim()) return '';
  const trimmed = note.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export function formatAssignConflictMessage(message: string | null | undefined): string {
  const fallback = 'This driver cannot take the trip due to a schedule conflict. Choose another driver or adjust the trip time.';
  if (!message?.trim()) return fallback;
  if (message.includes('cannot reach') || message.includes('extra min') || message.includes('Timeline conflict')) {
    return message;
  }
  return message;
}

export function formatGenerateTripsSummary(result: GenerateTripsResult): string {
  const start = result.startDate ?? 'today';
  const end = result.endDate ?? start;
  const range = start === end ? start : `${start}–${end}`;
  const created = result.generatedCount ?? 0;
  const confirmed = result.confirmedCount ?? 0;
  const needs = result.needsDispatchCount ?? 0;
  const skipped = result.skippedCount ?? 0;
  const failed = result.failedCount ?? 0;

  let line = `Generated trips for ${range}. ${created} created, ${confirmed} confirmed, ${needs} need dispatch, ${skipped} skipped`;
  if (failed > 0) line += `, ${failed} failed`;
  line += '.';
  return line;
}

export function formatGenerateTripsExplanation(result: GenerateTripsResult): string {
  const needs = result.needsDispatchCount ?? 0;
  const confirmed = result.confirmedCount ?? 0;
  if (needs > 0 && confirmed > 0) {
    return 'Some trips were auto-confirmed with the default driver. Others need manual dispatch because the driver timeline was not feasible.';
  }
  if (needs > 0) {
    return 'No trips could be auto-confirmed. Review the Needs Dispatch queue and assign drivers manually.';
  }
  if ((result.skippedCount ?? 0) > 0 && (result.generatedCount ?? 0) === 0) {
    return 'All trips in this range already exist — nothing new was created.';
  }
  return 'Trips were created from active paid subscriptions using the dispatch feasibility engine.';
}

export function countNeedsDispatchTrips<T extends { needsDispatch?: boolean }>(trips: T[]): number {
  return trips.filter((t) => t.needsDispatch).length;
}

export type TripCardBadge = { key: string; label: string; variant: 'warning' | 'danger' | 'info' | 'gray' };

export function getTripCardBadges(trip: {
  needsDispatch?: boolean;
  dispatchNote?: string | null;
  status?: string;
  driver?: unknown | null;
  gpsStale?: boolean;
  chatFlagged?: boolean;
  safetyCount?: number;
}): TripCardBadge[] {
  const badges: TripCardBadge[] = [];
  if (trip.needsDispatch) {
    badges.push({ key: 'needs-dispatch', label: 'Needs dispatch', variant: 'warning' });
  } else if (!trip.driver && ['SCHEDULED', 'DRIVER_ASSIGNED'].includes(trip.status ?? '')) {
    badges.push({ key: 'unassigned', label: 'Unassigned', variant: 'warning' });
  }
  if (trip.gpsStale) badges.push({ key: 'gps', label: 'GPS stale', variant: 'danger' });
  if (trip.chatFlagged) badges.push({ key: 'chat', label: 'Chat flagged', variant: 'danger' });
  if ((trip.safetyCount ?? 0) > 0) badges.push({ key: 'safety', label: 'Safety report', variant: 'danger' });
  if (trip.status === 'NO_SHOW') badges.push({ key: 'no-show', label: 'No show', variant: 'danger' });
  return badges;
}

export function getPrimaryTripAction(trip: {
  status: string;
  needsDispatch?: boolean;
  driver?: unknown | null;
}): 'assign' | 'reassign' | 'track' | 'details' {
  if (trip.needsDispatch || (!trip.driver && ['SCHEDULED', 'DRIVER_ASSIGNED'].includes(trip.status))) {
    return 'assign';
  }
  if (trip.driver && ['SCHEDULED', 'DRIVER_ASSIGNED'].includes(trip.status)) return 'reassign';
  if (['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'].includes(trip.status)) {
    return 'track';
  }
  return 'details';
}

export function buildAdminTripListParams(filters: {
  status?: string;
  date?: string;
  driverId?: string;
  preset?: TripFilterPreset;
  search?: string;
  page?: number;
  limit?: number;
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.date) params.date = filters.date;
  if (filters.driverId) params.driverId = filters.driverId;
  if (filters.page) params.page = String(filters.page);
  if (filters.limit) params.limit = String(filters.limit);
  if (filters.search?.trim()) params.q = filters.search.trim();

  if (filters.preset === 'needs_dispatch') params.needsDispatch = 'true';
  else if (filters.preset === 'unassigned') params.unassigned = 'true';
  else if (filters.preset === 'active') params.status = 'ON_THE_WAY';
  else if (filters.preset === 'completed') params.status = 'COMPLETED';
  else if (filters.preset === 'cancelled') params.status = 'CANCELLED';
  else if (filters.status) params.status = filters.status;

  return params;
}

export function shouldShowTechnicalJsonPrimary(): boolean {
  return false;
}

export function formatTripDateTime(date: string, pickupTime: string | null | undefined): string {
  const dateLabel = new Date(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (!pickupTime) return dateLabel;
  const timeLabel = new Date(pickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dateLabel} · ${timeLabel}`;
}
