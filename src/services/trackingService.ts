export const trackingService = {
  /** Parent/driver: list of trackable trips. */
  listTrackable: async () => {
    const res = await fetch('/api/tracking');
    return res.json();
  },

  /** Get tracking data (trip + latest location + events) for a specific trip. */
  get: async (tripId: string) => {
    const res = await fetch(`/api/tracking/${encodeURIComponent(tripId)}`);
    return res.json();
  },

  /** Driver: push GPS location update. */
  updateLocation: async (tripId: string, lat: number, lng: number) => {
    const res = await fetch(`/api/tracking/${encodeURIComponent(tripId)}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
    return res.json();
  },

  /** Parent: fetch latest location for a trip. */
  getLocation: async (tripId: string) => {
    const res = await fetch(`/api/tracking/${encodeURIComponent(tripId)}/location`);
    return res.json();
  },
};
