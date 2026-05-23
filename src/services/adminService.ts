type ApiResponse<T> = { data: T | null; error: { message: string } | null };

async function apiFetch<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, init);
    return await res.json();
  } catch {
    return { data: null, error: { message: 'Network error' } };
  }
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
    role?: string;                 // legacy — prefer accountType
    accountType?: string;          // FAMILY_PARENT | DRIVER_APPLICANT | APPROVED_DRIVER | ADMIN
    applicationStatus?: string;    // NOT_SUBMITTED | PENDING | NEEDS_CHANGES | REJECTED | APPROVED
    page?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.search)            q.set('search', params.search);
    if (params.role)              q.set('role', params.role);
    if (params.accountType)       q.set('accountType', params.accountType);
    if (params.applicationStatus) q.set('applicationStatus', params.applicationStatus);
    if (params.page)              q.set('page', String(params.page));
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
  list: (params: { parentId?: string; isActive?: boolean; search?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.parentId) q.set('parentId', params.parentId);
    if (params.isActive !== undefined) q.set('isActive', String(params.isActive));
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
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
  list: (params: { isSuspended?: boolean; page?: number; search?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.isSuspended !== undefined) q.set('isSuspended', String(params.isSuspended));
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    return apiFetch<{ drivers: unknown[]; meta: unknown }>(`/api/admin/drivers?${q}`);
  },
  update: (id: string, data: { availability?: boolean; isSuspended?: boolean; suspensionReason?: string }) =>
    apiFetch<unknown>(`/api/admin/drivers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
};

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const adminSubscriptionService = {
  list: (params: { status?: string; paymentStatus?: string; userId?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.paymentStatus) q.set('paymentStatus', params.paymentStatus);
    if (params.userId) q.set('userId', params.userId);
    if (params.page) q.set('page', String(params.page));
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
  /** List non-suspended drivers with conflict info for a specific subscription. */
  listAvailableDrivers: (subscriptionId: string) =>
    apiFetch<unknown[]>(`/api/admin/subscriptions/${subscriptionId}/available-drivers`),
  /** Assign (or reassign) a driver to a subscription. */
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
  payments: (params: { status?: string; purpose?: string; page?: number; dateFrom?: string; dateTo?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.purpose) q.set('purpose', params.purpose);
    if (params.page) q.set('page', String(params.page));
    if (params.dateFrom) q.set('dateFrom', params.dateFrom);
    if (params.dateTo) q.set('dateTo', params.dateTo);
    return apiFetch<{ payments: unknown[]; meta: unknown }>(`/api/admin/payments?${q}`);
  },
  walletTransactions: (params: { userId?: string; txType?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.txType) q.set('txType', params.txType);
    if (params.page) q.set('page', String(params.page));
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
  list: (params: { userId?: string; action?: string; page?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.userId) q.set('userId', params.userId);
    if (params.action) q.set('action', params.action);
    if (params.page) q.set('page', String(params.page));
    return apiFetch<{ logs: unknown[]; meta: unknown }>(`/api/admin/audit-logs?${q}`);
  },
};
