type DriverApplicationJson = {
  data?: unknown;
  error?: { message?: string };
  unauthorized?: boolean;
};

async function parseResponse(res: Response): Promise<DriverApplicationJson> {
  const json = (await res.json()) as DriverApplicationJson;
  if (res.status === 401) {
    return { ...json, unauthorized: true };
  }
  return json;
}

export const driverApplicationService = {
  get: async () => {
    const res = await fetch('/api/driver-application');
    return parseResponse(res);
  },
  submit: async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/driver-application', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseResponse(res);
  },
  resubmit: async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/driver-application', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseResponse(res);
  },
  // Admin
  adminList: async (status?: string, page = 1) => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    const res = await fetch(`/api/admin/driver-applications?${params}`);
    return res.json();
  },
  adminReview: async (
    id: string,
    action: 'APPROVE' | 'REJECT' | 'NEEDS_CHANGES',
    adminResponse?: string,
  ) => {
    const res = await fetch(`/api/admin/driver-applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, adminResponse }),
    });
    return res.json();
  },
};
