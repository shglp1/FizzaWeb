/** Normalize admin trip detail API payload for TripDetailDrawer. */

export type AdminTripDetailApiData = {
  trip: {
    id: string;
    status: string;
    statusReason?: string | null;
    scheduledDate: string;
    scheduledPickupTime: string | null;
    scheduledDropoffTime?: string | null;
    pickupLocation: string;
    dropoffLocation: string;
    pickupLat?: number | null;
    pickupLng?: number | null;
    dropoffLat?: number | null;
    dropoffLng?: number | null;
    rider?: {
      name?: string;
      relationship?: string;
      parent?: { fullName?: string; phone?: string | null } | null;
    } | null;
    driver?: {
      profile?: { fullName?: string; phone?: string | null } | null;
      rating?: string | number | null;
    } | null;
    events?: { id: string; eventType: string; message?: string | null; createdAt: string }[];
  };
  parent?: { fullName?: string; phone?: string | null } | null;
  chatSummary?: { flagged?: number };
};

export type NormalizedAdminTripDetail = {
  id: string;
  status: string;
  statusReason?: string | null;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime?: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  rider?: { name?: string; relationship?: string } | null;
  driver?: {
    profile?: { fullName?: string; phone?: string } | null;
    rating?: string | number | null;
  } | null;
  parent?: { profile?: { fullName?: string; phone?: string } | null } | null;
  events?: { id: string; eventType: string; message?: string | null; createdAt: string }[];
  chatBlocked?: boolean;
};

export function normalizeAdminTripDetail(data: AdminTripDetailApiData): NormalizedAdminTripDetail {
  const { trip, parent, chatSummary } = data;
  const parentProfile = parent ?? trip.rider?.parent ?? null;

  return {
    id: trip.id,
    status: trip.status,
    statusReason: trip.statusReason,
    scheduledDate: trip.scheduledDate,
    scheduledPickupTime: trip.scheduledPickupTime,
    scheduledDropoffTime: trip.scheduledDropoffTime,
    pickupLocation: trip.pickupLocation,
    dropoffLocation: trip.dropoffLocation,
    pickupLat: trip.pickupLat,
    pickupLng: trip.pickupLng,
    dropoffLat: trip.dropoffLat,
    dropoffLng: trip.dropoffLng,
    rider: trip.rider
      ? { name: trip.rider.name, relationship: trip.rider.relationship }
      : null,
    driver: trip.driver
      ? {
          ...trip.driver,
          profile: trip.driver.profile
            ? {
                fullName: trip.driver.profile.fullName,
                phone: trip.driver.profile.phone ?? undefined,
              }
            : null,
        }
      : null,
    parent: parentProfile
      ? { profile: { fullName: parentProfile.fullName, phone: parentProfile.phone ?? undefined } }
      : null,
    events: trip.events,
    chatBlocked: (chatSummary?.flagged ?? 0) > 0,
  };
}
