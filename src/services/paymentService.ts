export const paymentService = {
  createPayment: async (payload: {
    purpose: 'WALLET_TOP_UP' | 'SUBSCRIPTION_PAYMENT';
    amountSar?: number;
    subscriptionId?: string;
  }) => {
    const res = await fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  getPayment: async (id: string) => {
    const res = await fetch(`/api/payments/${encodeURIComponent(id)}`);
    return res.json();
  },
  listPayments: async (page = 1, limit = 20) => {
    const res = await fetch(`/api/payments?page=${page}&limit=${limit}`);
    return res.json();
  },
};
