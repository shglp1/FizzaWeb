type ApiResponse<T> = { data: T | null; error: { message: string } | null };

async function apiFetch<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch {
    return { data: null, error: { message: 'Network error' } };
  }
}

function appendListParams(
  q: URLSearchParams,
  params: { page?: number; limit?: number },
) {
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export const adminStatsService = {
  get: () => apiFetch<Record<string, unknown>>('/api/admin/stats'),
};

// ─── System Configurations ────────────────────────────────────────────────────

export const systemConfigService = {
  list: () => apiFetch<{ key: string; value: unknown; updatedAt: string }[]>('/api/admin/system-configurations'),
  update: (data: Record<string, string | number | boolean>) =>
    apiFetch<unknown[]>('/api/admin/system-configurations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const adminUserService = {
  list: (params: {
    search?: string;
    role?: string;
    accountType?: string;
    applicationStatus?: string;
    sort?: 'newest' | 'oldest' | 'name_asc' | 'account_type';
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.role) q.set('role', params.role);
    if (params.accountType) q.set('accountType', params.accountType);
    if (params.applicationStatus) q.set('applicationStatus', params.applicationStatus);
    if (params.sort) q.set('sort', params.sort);
    appendListParams(q, params);
    return apiFetch<{ users: unknown[]; meta: unknown; summary: unknown }>(`/api/admin/users?${q}`);
  },
  get: (id: string) => apiFetch<unknown>(`/api/admin/users/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// ─── Riders ───────────────────────────────────────────────────────────────────

export const adminRiderService = {
  list: (params: { parentId?: string; isActive?: boolean; search?: string; page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.parentId) q.set('parentId', params.parentId);
    if (params.isActive !== undefined) q.set('isActive', String(params.isActive));
    if (params.search) q.set('search', params.search);
    appendListParams(q, params);
    return apiFetch<{ riders: unknown[]; meta: unknown }>(`/api/admin/riders?${q}`);
  },
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/admin/riders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// ─── Drivers ──────────────────────────────────────────────────────────────────

export const adminDriverService = {
  list: (params: {
    isSuspended?: boolean;
    available?: boolean;
    vehicleType?: string;
    city?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.isSuspended !== undefined) q.set('isSuspended', String(params.isSuspended));
    if (params.available !== undefined) q.set('available', String(params.available));
    if (params.vehicleType) q.set('vehicleType', params.vehicleType);
    if (params.city) q.set('city', params.city);
    if (params.search) q.set('search', params.search);
    appendListParams(q, params);
    return apiFetch<{ drivers: unknown[]; meta: unknown }>(`/api/admin/drivers?${q}`);
  },
  update: (id: string, data: { availability?: boolean; isSuspended?: boolean; suspensionReason?: string }) =>
    apiFetch<unknown>(`/api/admin/drivers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  chatBlock: (id: string, data: { reason: string; endsAt?: string; active?: boolean }) =>
    apiFetch<unknown>(`/api/admin/drivers/${id}/chat-block`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  unblockChat: (blockId: string) =>
    apiFetch<unknown>(`/api/admin/chat/blocks/${blockId}/unblock`, { method: 'PATCH' }),
};

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const adminSubscriptionService = {
  list: (params: {
    status?: string;
    paymentStatus?: string;
    userId?: string;
    search?: string;
    assignedDriverId?: string;
    unassigned?: boolean;
    assigned?: boolean;
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.paymentStatus) q.set('paymentStatus', params.paymentStatus);
    if (params.userId) q.set('userId', params.userId);
    if (params.search) q.set('search', params.search);
    if (params.assignedDriverId) q.set('assignedDriverId', params.assignedDriverId);
    if (params.unassigned) q.set('unassigned', 'true');
    if (params.assigned) q.set('assigned', 'true');
    appendListParams(q, params);
    return apiFetch<{ subscriptions: unknown[]; meta: unknown }>(`/api/admin/subscriptions?${q}`);
  },
  get: (id: string) => apiFetch<unknown>(`/api/admin/subscriptions/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/admin/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  cancel: (id: string, reason: string) =>
    apiFetch<unknown>(`/api/admin/subscriptions/${id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),
  listAvailableDrivers: (subscriptionId: string) =>
    apiFetch<unknown[]>(`/api/admin/subscriptions/${subscriptionId}/available-drivers`),
  assignDriver: (subscriptionId: string, data: { driverId: string; effectiveFrom?: string; notes?: string }) =>
    apiFetch<unknown>(`/api/admin/subscriptions/${subscriptionId}/assign-driver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// ─── Financials ───────────────────────────────────────────────────────────────

export const adminFinancialService = {
  overview: (params: { dateFrom?: string; dateTo?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo) q.set('dateTo', params.dateTo);
    return apiFetch<Record<string, unknown>>(`/api/admin/financials/overview?${q}`);
  },
  payments: (params: {
    status?: string;
    purpose?: string;
    page?: number;
    limit?: number;
    dateFrom?: string;
    dateTo?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.purpose) q.set('purpose', params.purpose);
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo) q.set('dateTo', params.dateTo);
    appendListParams(q, params);
    return apiFetch<{ payments: unknown[]; meta: unknown }>(`/api/admin/payments?${q}`);
  },
  walletTransactions: (params: { userId?: string; txType?: string; page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.txType) q.set('txType', params.txType);
    appendListParams(q, params);
    return apiFetch<{ transactions: unknown[]; meta: unknown }>(`/api/admin/wallet-transactions?${q}`);
  },
  adjustWallet: (userId: string, amountSar: number, reason: string) =>
    apiFetch<unknown>('/api/admin/wallet-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, amountSar, reason }),
    }),
};

// ─── Subscription Packages ────────────────────────────────────────────────────

export const adminPackageService = {
  list: (includeInactive = false) =>
    apiFetch<unknown[]>(
      `/api/admin/subscription-packages?includeInactive=${includeInactive}`,
    ),
  create: (data: {
    name: string;
    billingCycle: string;
    priceSar: number;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) =>
    apiFetch<unknown>('/api/admin/subscription-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: {
      name?: string;
      billingCycle?: string;
      priceSar?: number;
      description?: string | null;
      sortOrder?: number | null;
      isActive?: boolean;
    },
  ) =>
    apiFetch<unknown>(`/api/admin/subscription-packages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiFetch<unknown>(`/api/admin/subscription-packages/${id}`, { method: 'DELETE' }),
};

// ─── Add-ons ──────────────────────────────────────────────────────────────────

export const adminAddOnService = {
  list: (includeInactive = false) =>
    apiFetch<unknown[]>(`/api/admin/add-ons?includeInactive=${includeInactive}`),
  create: (data: {
    name: string;
    priceSar: number;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) =>
    apiFetch<unknown>('/api/admin/add-ons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: {
      name?: string;
      priceSar?: number;
      description?: string | null;
      sortOrder?: number | null;
      isActive?: boolean;
    },
  ) =>
    apiFetch<unknown>(`/api/admin/add-ons/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  remove: (id: string) =>
    apiFetch<unknown>(`/api/admin/add-ons/${id}`, { method: 'DELETE' }),
};

// ─── Promo codes ──────────────────────────────────────────────────────────────

export const adminPromoService = {
  list: () => apiFetch<unknown[]>('/api/admin/promo-codes'),
  create: (data: {
    code: string;
    partnerName?: string | null;
    discountPercent: number;
    maxUses?: number | null;
    expiresAt?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }) =>
    apiFetch<unknown>('/api/admin/promo-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: {
      code?: string;
      partnerName?: string | null;
      discountPercent?: number;
      maxUses?: number | null;
      expiresAt?: string | null;
      notes?: string | null;
      isActive?: boolean;
    },
  ) =>
    apiFetch<unknown>(`/api/admin/promo-codes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  get: (id: string) => apiFetch<unknown>(`/api/admin/promo-codes/${id}`),
};

// ─── Map places registry ─────────────────────────────────────────────────────

export const adminMapPlaceService = {
  list: (params?: { q?: string; city?: string; type?: string; active?: string; verified?: string }) => {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.city) sp.set('city', params.city);
    if (params?.type) sp.set('type', params.type);
    if (params?.active) sp.set('active', params.active);
    if (params?.verified) sp.set('verified', params.verified);
    const qs = sp.toString();
    return apiFetch<unknown[]>(`/api/admin/map-places${qs ? `?${qs}` : ''}`);
  },
  create: (data: Record<string, unknown>) =>
    apiFetch<unknown>('/api/admin/map-places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/admin/map-places/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  get: (id: string) => apiFetch<unknown>(`/api/admin/map-places/${id}`),
};

// ─── Admin-created subscriptions ──────────────────────────────────────────────

export const adminSubscriptionCreateService = {
  create: (data: Record<string, unknown>) =>
    apiFetch<unknown>('/api/admin/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const adminAuditService = {
  list: (params: {
    userId?: string;
    action?: string;
    actor?: string;
    severity?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.action) q.set('action', params.action);
    if (params.actor) q.set('actor', params.actor);
    if (params.severity) q.set('severity', params.severity);
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo) q.set('dateTo', params.dateTo);
    appendListParams(q, params);
    return apiFetch<{ logs: unknown[]; meta: unknown }>(`/api/admin/audit-logs?${q}`);
  },
};

// ─── Driver Applications ──────────────────────────────────────────────────────

export const adminApplicationService = {
  list: (params: { status?: string; page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    appendListParams(q, params);
    return apiFetch<{ applications: unknown[]; meta: unknown }>(`/api/admin/driver-applications?${q}`);
  },
};

// ─── Trips ────────────────────────────────────────────────────────────────────

export const adminTripService = {
  list: (params: {
    status?: string;
    date?: string;
    driverId?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.date) q.set('date', params.date);
    if (params.driverId) q.set('driverId', params.driverId);
    appendListParams(q, params);
    return apiFetch<{ trips: unknown[]; meta: unknown }>(`/api/admin/trips?${q}`);
  },
  operations: () => apiFetch<Record<string, unknown>>('/api/admin/trips/operations'),
};

// ─── Safety Reports ───────────────────────────────────────────────────────────

export const adminSafetyService = {
  list: (params: {
    status?: string;
    category?: string;
    severity?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.category) q.set('category', params.category);
    if (params.severity) q.set('severity', params.severity);
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo) q.set('dateTo', params.dateTo);
    appendListParams(q, params);
    return apiFetch<{ reports: unknown[]; meta: unknown }>(`/api/admin/safety-reports?${q}`);
  },
};
