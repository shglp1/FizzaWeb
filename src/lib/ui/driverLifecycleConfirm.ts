/**
 * Driver lifecycle confirm dialogs and GPS warnings (school transport).
 */
import type { TripStatus } from '../trips/tripLifecycle.ts';
import type { TripLegType } from '../tracking/trackingTypes.ts';

export type StatusConfirmKind = 'picked_up' | 'complete_trip' | 'no_show';

export function getStatusConfirmKind(nextStatus: TripStatus): StatusConfirmKind | null {
  if (nextStatus === 'PICKED_UP') return 'picked_up';
  if (nextStatus === 'COMPLETED') return 'complete_trip';
  if (nextStatus === 'NO_SHOW') return 'no_show';
  return null;
}

export function statusAdvanceNeedsGpsWarning(nextStatus: TripStatus): boolean {
  return ['ON_THE_WAY', 'PICKED_UP', 'COMPLETED'].includes(nextStatus);
}

export function getDriverActionLabel(
  status: TripStatus,
  legType?: TripLegType | null,
): string {
  const isReturn = legType === 'RETURN';
  switch (status) {
    case 'SCHEDULED':
      return 'Awaiting assignment';
    case 'DRIVER_ASSIGNED':
      return 'Start trip';
    case 'PRE_TRIP':
      return 'Heading to pickup';
    case 'ON_THE_WAY':
      return 'Arrived at pickup';
    case 'ARRIVED_PICKUP':
      return 'Student picked up';
    case 'PICKED_UP':
      return isReturn ? 'Heading to home' : 'Heading to school';
    case 'EN_ROUTE_DROPOFF':
      return isReturn ? 'Arrived home' : 'Arrived at school';
    case 'ARRIVED_DROPOFF':
      return 'Complete trip — student delivered';
    case 'COMPLETED':
      return 'View summary';
    case 'CANCELLED':
      return 'Cancelled';
    case 'NO_SHOW':
      return 'No show';
    default:
      return status;
  }
}

export function getStatusConfirmCopy(
  kind: StatusConfirmKind,
  riderName: string,
  legType?: TripLegType | null,
): { title: string; body: string; confirmLabel: string; requireReason: boolean } {
  const isReturn = legType === 'RETURN';
  switch (kind) {
    case 'picked_up':
      return {
        title: 'Confirm student picked up',
        body: `Confirm ${riderName} is onboard and secured before heading to ${isReturn ? 'home' : 'school'}.`,
        confirmLabel: 'Yes, picked up',
        requireReason: false,
      };
    case 'complete_trip':
      return {
        title: 'Confirm trip complete',
        body: `Confirm ${riderName} was safely delivered. This closes live tracking for the family.`,
        confirmLabel: 'Yes, complete trip',
        requireReason: false,
      };
    case 'no_show':
      return {
        title: 'Mark student no-show?',
        body: 'Only if the student did not appear after you arrived at pickup.',
        confirmLabel: 'Mark no-show',
        requireReason: true,
      };
  }
}

export const GPS_WARN_ON_STATUS =
  'Families may not see your live location. Enable GPS sharing for safer tracking.';
