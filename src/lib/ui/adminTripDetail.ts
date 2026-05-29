/** Normalize admin trip detail API payload for TripDetailDrawer. */

export type AdminTripDetailApiData = {
  trip: {
    id: string;
    status: string;
    statusReason?: string | null;
    needsDispatch?: boolean;
    dispatchNote?: string | null;
    legType?: string;
    scheduledDate: string;
    scheduledPickupTime: string | null;
    scheduledDropoffTime?: string | null;
    pickupLocation: string;
    dropoffLocation: string;
    pickupLat?: number | null;
    pickupLng?: number | null;
    dropoffLat?: number | null;
    dropoffLng?: number | null;
    financialReviewStatus?: string | null;
    financialReviewReason?: string | null;
    financialReviewedAt?: string | null;
    walletCreditTransactionId?: string | null;
    rider?: {
      name?: string;
      relationship?: string;
      parent?: { fullName?: string; phone?: string | null } | null;
    } | null;
    driver?: {
      profile?: { fullName?: string; phone?: string | null } | null;
      rating?: string | number | null;
    } | null;
    subscription?: {
      id?: string;
      subscriptionType?: string;
      assignedDriverId?: string | null;
      assignedDriver?: {
        profile?: { fullName?: string } | null;
      } | null;
      package?: { name?: string } | null;
    } | null;
    events?: { id: string; eventType: string; message?: string | null; createdAt: string }[];
    safetyReports?: { id: string; category: string; status: string; description: string; createdAt: string }[];
  };
  parent?: { fullName?: string; phone?: string | null } | null;
  chatSummary?: { flagged?: number; total?: number };
  location?: { stale?: boolean } | null;
};

export type NormalizedAdminTripDetail = {
  id: string;
  status: string;
  statusReason?: string | null;
  needsDispatch?: boolean;
  dispatchNote?: string | null;
  legType?: string;
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
  subscription?: {
    id?: string;
    subscriptionType?: string;
    packageName?: string;
    defaultDriverName?: string | null;
  } | null;
  events?: { id: string; eventType: string; message?: string | null; createdAt: string }[];
  safetyReports?: { id: string; category: string; status: string; description: string; createdAt: string }[];
  chatFlaggedCount?: number;
  chatTotal?: number;
  gpsStale?: boolean;
  financialReviewStatus?: string | null;
  financialReviewReason?: string | null;
  financialReviewedAt?: string | null;
  walletCreditTransactionId?: string | null;
};

export function normalizeAdminTripDetail(data: AdminTripDetailApiData): NormalizedAdminTripDetail {
  const { trip, parent, chatSummary, location } = data;
  const parentProfile = parent ?? trip.rider?.parent ?? null;

  return {
    id: trip.id,
    status: trip.status,
    statusReason: trip.statusReason,
    needsDispatch: trip.needsDispatch,
    dispatchNote: trip.dispatchNote,
    legType: trip.legType,
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
    subscription: trip.subscription
      ? {
          id: trip.subscription.id,
          subscriptionType: trip.subscription.subscriptionType,
          packageName: trip.subscription.package?.name,
          defaultDriverName: trip.subscription.assignedDriver?.profile?.fullName ?? null,
        }
      : null,
    events: trip.events,
    safetyReports: trip.safetyReports,
    chatFlaggedCount: chatSummary?.flagged ?? 0,
    chatTotal: chatSummary?.total ?? 0,
    gpsStale: location?.stale ?? false,
    financialReviewStatus: trip.financialReviewStatus ?? null,
    financialReviewReason: trip.financialReviewReason ?? null,
    financialReviewedAt: trip.financialReviewedAt ?? null,
    walletCreditTransactionId: trip.walletCreditTransactionId ?? null,
  };
}
