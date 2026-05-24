/** Shared types for dispatch feasibility and trip generation. */

export type TimelineTrip = {
  id: string;
  scheduledPickupTime: Date | null;
  scheduledDropoffTime?: Date | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  /** Estimated leg duration when dropoff time is unknown (minutes). */
  legDurationMinutes?: number | null;
};

export type DispatchConfig = {
  bufferMinutes: number;
  defaultLegDurationMinutes: number;
  defaultTravelMinutesNoCoords: number;
  averageFallbackSpeedKmh: number;
  generationHorizonDays: number;
};

export type FeasibilityIssue = {
  priorTripId: string;
  tripId: string;
  message: string;
};

export type FeasibilityResult = {
  feasible: boolean;
  issues: FeasibilityIssue[];
};

export type GenerateTripsResult = {
  generatedCount: number;
  skippedCount: number;
  confirmedCount: number;
  needsDispatchCount: number;
  failedCount: number;
  startDate: string;
  endDate: string;
  subscriptionsChecked: number;
};

export type TripDispatchDecision = {
  assignDriver: boolean;
  needsDispatch: boolean;
  dispatchNote: string | null;
  status: 'SCHEDULED' | 'DRIVER_ASSIGNED';
  driverId: string | null;
};
