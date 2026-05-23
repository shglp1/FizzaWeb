export const tripService = {
  list: async (opts?: string | { status?: string; from?: string; to?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (typeof opts === 'string') {
      if (opts) params.set('status', opts);
    } else if (opts) {
      if (opts.status) params.set('status', opts.status);
      if (opts.from) params.set('from', opts.from);
      if (opts.to) params.set('to', opts.to);
      if (opts.page) params.set('page', String(opts.page));
      if (opts.limit) params.set('limit', String(opts.limit));
    }
    const qs = params.toString();
    const res = await fetch(`/api/trips${qs ? `?${qs}` : ''}`);
    return res.json();
  },

  get: async (id: string) => {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}`);
    return res.json();
  },

  cancel: async (id: string, reason?: string) => {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return res.json();
  },

  reportLate: async (id: string, type: 'DRIVER' | 'RIDER', reason?: string) => {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}/late`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, reason }),
    });
    return res.json();
  },

  updateStatus: async (
    id: string,
    status: string,
    opts?: { statusReason?: string; lat?: number; lng?: number },
  ) => {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...opts }),
    });
    return res.json();
  },

  // ── Chat ──────────────────────────────────────────────────────────────────

  getChat: async (id: string) => {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}/chat`);
    return res.json();
  },

  sendChatMessage: async (id: string, body: string, messageType: 'TEXT' | 'QUICK_REPLY' = 'TEXT') => {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, messageType }),
    });
    return res.json();
  },

  // ── Admin ─────────────────────────────────────────────────────────────────

  adminList: async (filters?: { status?: string; date?: string; driverId?: string; page?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.date) params.set('date', filters.date);
    if (filters?.driverId) params.set('driverId', filters.driverId);
    if (filters?.page) params.set('page', String(filters.page));
    const res = await fetch(`/api/admin/trips?${params}`);
    return res.json();
  },

  adminOperations: async () => {
    const res = await fetch('/api/admin/trips/operations');
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

  adminChatFlags: async (page = 1) => {
    const res = await fetch(`/api/admin/chat/flags?page=${page}`);
    return res.json();
  },

  adminModerateMessage: async (
    messageId: string,
    data: { moderationStatus?: 'CLEAN' | 'FLAGGED' | 'BLOCKED'; delete?: boolean },
  ) => {
    const res = await fetch(`/api/admin/chat/messages/${encodeURIComponent(messageId)}/moderate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  adminGetTrip: async (tripId: string) => {
    const res = await fetch(`/api/admin/trips/${encodeURIComponent(tripId)}`);
    return res.json();
  },

  adminReassignTrip: async (tripId: string, driverId: string, reason: string, applyToFuture = false) => {
    const res = await fetch(`/api/admin/trips/${encodeURIComponent(tripId)}/reassign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, reason, applyToFuture }),
    });
    return res.json();
  },

  adminCheckLate: async () => {
    const res = await fetch('/api/admin/trips/check-late', { method: 'POST' });
    return res.json();
  },

  uploadChatAttachment: async (tripId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/chat/attachment`, {
      method: 'POST',
      body: form,
    });
    return res.json();
  },
};
