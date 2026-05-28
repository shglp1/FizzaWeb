import type { LiveEtaInfo, TrackingPayload } from '@/lib/tracking/trackingTypes';
import type { LocationPollPayload } from '@/lib/tracking/locationPollState';

type ApiResponse<T> = { data: T | null; error: { message: string } | null };

export type { LocationPollPayload };

export const trackingService = {
  /** Parent/driver: list of trackable trips. */
  listTrackable: async (): Promise<ApiResponse<{ trips: unknown[] }>> => {
    const res = await fetch('/api/tracking');
    return res.json();
  },

  /** Get tracking data (trip + latest location + events) for a specific trip. */
  get: async (tripId: string): Promise<ApiResponse<TrackingPayload>> => {
    const res = await fetch(`/api/tracking/${encodeURIComponent(tripId)}`);
    return res.json();
  },

  /** Driver: push GPS location update. */
  updateLocation: async (tripId: string, lat: number, lng: number): Promise<ApiResponse<{ ok: boolean }>> => {
    const res = await fetch(`/api/tracking/${encodeURIComponent(tripId)}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
    return res.json();
  },

  /** Parent: fetch latest location for a trip. */
  getLocation: async (tripId: string): Promise<ApiResponse<LocationPollPayload>> => {
    const res = await fetch(`/api/tracking/${encodeURIComponent(tripId)}/location`);
    return res.json();
  },
};
