export const safetyService = {
  listReports: async (filters?: { status?: string; category?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const res = await fetch(`/api/safety-reports?${params}`);
    return res.json();
  },

  getReport: async (id: string) => {
    const res = await fetch(`/api/safety-reports/${encodeURIComponent(id)}`);
    return res.json();
  },

  createReport: async (payload: {
    category: string;
    description: string;
    tripId?: string;
    attachmentUrls?: string[];
  }) => {
    const res = await fetch('/api/safety-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  updateReport: async (id: string, payload: { description?: string; attachmentUrls?: string[] }) => {
    const res = await fetch(`/api/safety-reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  adminListReports: async (filters?: {
    status?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const res = await fetch(`/api/admin/safety-reports?${params}`);
    return res.json();
  },

  adminReviewReport: async (
    id: string,
    payload: { action: 'APPROVE' | 'REJECT' | 'RESOLVE'; adminResponse?: string },
  ) => {
    const res = await fetch(`/api/admin/safety-reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};
