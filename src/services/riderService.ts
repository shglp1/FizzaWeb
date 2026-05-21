export const riderService = {
  list: async () => {
    const res = await fetch('/api/riders');
    return res.json();
  },
  create: async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/riders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch('/api/riders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload, action: 'update' })
    });
    return res.json();
  }
};
