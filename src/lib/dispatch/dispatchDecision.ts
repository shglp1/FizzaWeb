import type { TimelineTrip } from './types.ts';
import type { DispatchConfig } from './types.ts';
import { canAddTripToTimeline } from './feasibility.ts';

export type DispatchDecisionInput = {
  driverId: string | null;
  driverAvailable: boolean;
  candidate: TimelineTrip;
  existingTimeline: TimelineTrip[];
  config: DispatchConfig;
};

export type DispatchDecisionOutput = {
  assignDriver: boolean;
  needsDispatch: boolean;
  dispatchNote: string | null;
  status: 'SCHEDULED' | 'DRIVER_ASSIGNED';
  driverId: string | null;
};

/** Pure-ish dispatch outcome from feasibility (no DB). Used by decideTripDispatch + tests. */
export async function resolveDispatchDecision(input: DispatchDecisionInput): Promise<DispatchDecisionOutput> {
  if (!input.driverId) {
    return {
      assignDriver: false,
      needsDispatch: true,
      dispatchNote: 'No default driver assigned to subscription',
      status: 'SCHEDULED',
      driverId: null,
    };
  }

  if (!input.driverAvailable) {
    return {
      assignDriver: false,
      needsDispatch: true,
      dispatchNote: 'Assigned driver unavailable or missing vehicle',
      status: 'SCHEDULED',
      driverId: null,
    };
  }

  const feasibility = await canAddTripToTimeline(input.existingTimeline, input.candidate, input.config);

  if (feasibility.feasible) {
    return {
      assignDriver: true,
      needsDispatch: false,
      dispatchNote: null,
      status: 'DRIVER_ASSIGNED',
      driverId: input.driverId,
    };
  }

  return {
    assignDriver: false,
    needsDispatch: true,
    dispatchNote: feasibility.reason,
    status: 'SCHEDULED',
    driverId: null,
  };
}
