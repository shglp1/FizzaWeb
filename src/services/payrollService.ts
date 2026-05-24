type ApiResponse<T> = { data: T | null; error: { message: string; code?: string } | null };

async function apiFetch<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('text/csv')) {
      const text = await res.text();
      if (!res.ok) {
        try {
          const json = JSON.parse(text) as ApiResponse<T>;
          return json;
        } catch {
          return { data: null, error: { message: 'Export failed' } };
        }
      }
      return { data: text as T, error: null };
    }
    return await res.json();
  } catch {
    return { data: null, error: { message: 'Network error' } };
  }
}

export const payrollService = {
  listRuns: () => apiFetch<unknown[]>('/api/admin/payroll/runs'),
  getRun: (year: number, month: number) =>
    apiFetch<unknown>(`/api/admin/payroll/runs?year=${year}&month=${month}`),
  generate: (data: { year: number; month: number; regenerate?: boolean; notes?: string }) =>
    apiFetch<unknown>('/api/admin/payroll/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  exportCsv: (year: number, month: number) =>
    apiFetch<string>(`/api/admin/payroll/export?year=${year}&month=${month}`),
  updateLine: (id: string, data: {
    deductionsSar?: number;
    bonusesSar?: number;
    adminNotes?: string;
    status?: 'DRAFT' | 'APPROVED';
  }) =>
    apiFetch<unknown>(`/api/admin/payroll/lines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updateTripEarningKm: (earningId: string, billableKm: number) =>
    apiFetch<unknown>(`/api/admin/payroll/trip-earnings/${earningId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billableKm }),
    }),
  setTripKmOverride: (tripId: string, billableKmOverride: number | null) =>
    apiFetch<unknown>(`/api/admin/trips/${tripId}/billable-km`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billableKmOverride }),
    }),
  markPaid: (id: string) =>
    apiFetch<unknown>(`/api/admin/payroll/lines/${id}/mark-paid`, { method: 'POST' }),
  getDriverPayProfile: (driverId: string) =>
    apiFetch<unknown>(`/api/admin/drivers/${driverId}/pay-profile`),
  updateDriverPayProfile: (driverId: string, data: {
    ratePerKmSar?: number | null;
    platformFeePercent?: number | null;
  }) =>
    apiFetch<unknown>(`/api/admin/drivers/${driverId}/pay-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  getDriverPayoutProfile: (driverId: string) =>
    apiFetch<{ profile: unknown; multiVendorConfigured: boolean }>(`/api/admin/drivers/${driverId}/payout-profile`),
  syncDriverSupplier: (driverId: string) =>
    apiFetch<unknown>(`/api/admin/drivers/${driverId}/payout-profile`, { method: 'POST' }),
};

export const driverEarningsService = {
  get: (params?: { year?: number; month?: number }) => {
    const q = new URLSearchParams();
    if (params?.year) q.set('year', String(params.year));
    if (params?.month) q.set('month', String(params.month));
    const qs = q.toString();
    return apiFetch<unknown>(`/api/driver/earnings${qs ? `?${qs}` : ''}`);
  },
};

export const driverPayoutService = {
  get: () => apiFetch<unknown>('/api/driver/payout-profile'),
  update: (data: {
    bankAccountHolderName: string;
    bankIban: string;
    bankAccountNumber?: string;
    bankId?: string;
  }) =>
    apiFetch<unknown>('/api/driver/payout-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};
