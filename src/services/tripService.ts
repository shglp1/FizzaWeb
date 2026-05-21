export const tripService = {
  list: async (status?: string) => {
    const params = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`/api/trips${params}`);
    return res.json();
  },

  get: async (id: string) => {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}`);
    return res.json();
  },

  cancel: async (id: string) => {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}/cancel`, {
      method: 'PATCH',
    });
    return res.json();
  },

  updateStatus: async (id: string, status: string) => {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  // Admin
  adminList: async (filters?: { status?: string; date?: string; driverId?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.date) params.set('date', filters.date);
    if (filters?.driverId) params.set('driverId', filters.driverId);
    if (filters?.page) params.set('page', String(filters.page));
    const res = await fetch(`/api/admin/trips?${params}`);
    return res.json();
  },

  adminAssignDriver: async (tripId: string, driverId: string) => {
    const res = await fetch(`/api/admin/trips/${encodeURIComponent(tripId)}/assign-driver`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId }),
    });
    return res.json();
  },

  adminGenerateTrips: async (startDate?: string, endDate?: string) => {
    const res = await fetch('/api/admin/trips/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate }),
    });
    return res.json();
  },

  adminListDrivers: async () => {
    const res = await fetch('/api/admin/drivers');
    return res.json();
  },
};
