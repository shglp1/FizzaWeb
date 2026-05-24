export const mapsService = {
  getRouteGeometry: async (input: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
  }) => {
    const params = new URLSearchParams({
      pickupLat: String(input.pickupLat),
      pickupLng: String(input.pickupLng),
      dropoffLat: String(input.dropoffLat),
      dropoffLng: String(input.dropoffLng),
    });
    const res = await fetch(`/api/maps/route?${params}`);
    return res.json() as Promise<{
      data: {
        coordinates: [number, number][];
        source: 'road' | 'approximate';
        fallbackLabel: string | null;
      } | null;
      error: { message: string } | null;
    }>;
  },
};
