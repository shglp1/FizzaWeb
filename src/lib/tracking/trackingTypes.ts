/** Shared types for trip tracking UI (parent + driver). */

export type TripLegType = 'OUTBOUND' | 'RETURN';

export type TripEvent = {
  id: string;
  eventType: string;
  message: string | null;
  actorRole: string;
  createdAt: string;
};

export type TrackingTrip = {
  id: string;
  status: string;
  statusReason: string | null;
  legType?: TripLegType | null;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  actualPickupTime: string | null;
  actualDropoffTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  rider: { id: string; name: string; relationship: string } | null;
  driver: {
    id: string;
    rating: number | string | null;
    profile: { fullName: string; phone: string; avatarUrl: string | null } | null;
  } | null;
  vehicle: { model: string; plateNumber: string; color: string } | null;
  events: TripEvent[];
};

export type DriverLocationSnapshot = {
  lat: number;
  lng: number;
  recordedAt: string;
  stale: boolean;
};

export type LiveEtaInfo = {
  liveEtaMinutes: number | null;
  etaTarget: 'pickup' | 'dropoff' | null;
  etaSource: 'ORS' | 'FALLBACK' | 'UNAVAILABLE';
};

export type TrackingPayload = {
  trip: TrackingTrip;
  location: DriverLocationSnapshot | null;
  tooEarly?: boolean;
  liveEta?: LiveEtaInfo;
};
