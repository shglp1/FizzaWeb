export const subscriptionService = {
  list: async () => {
    const res = await fetch('/api/subscriptions');
    return res.json();
  },

  create: async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  update: async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  cancel: async (id: string) => {
    const res = await fetch(`/api/subscriptions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.json();
  },

  listPackages: async () => {
    const res = await fetch('/api/subscription-packages');
    return res.json();
  },

  listAddOns: async () => {
    const res = await fetch('/api/add-ons');
    return res.json();
  },
};
