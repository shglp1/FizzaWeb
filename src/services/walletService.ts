export const walletService = {
  getWallet: async () => {
    const res = await fetch('/api/wallet');
    return res.json();
  },
  listTransactions: async (page = 1, limit = 20) => {
    const res = await fetch(`/api/wallet/transactions?page=${page}&limit=${limit}`);
    return res.json();
  },
  paySubscription: async (subscriptionId: string) => {
    const res = await fetch('/api/wallet/pay-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId }),
    });
    return res.json();
  },
};
