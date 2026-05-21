export const trackingService = {
  get: async (tripId: string) => {
    const res = await fetch(`/api/tracking/${encodeURIComponent(tripId)}`);
    return res.json();
  },

  updateLocation: async (tripId: string, lat: number, lng: number) => {
    const res = await fetch(`/api/tracking/${encodeURIComponent(tripId)}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
    return res.json();
  },
};
