export const riderService = {
  list: async () => {
    const res = await fetch('/api/riders');
    return res.json();
  },
  create: async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/riders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
  update: async (id: string, payload: Record<string, unknown>) => {
    const res = await fetch('/api/riders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    return res.json();
  },
  deactivate: async (id: string) => {
    const res = await fetch(`/api/riders?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return res.json();
  },
  reactivate: async (id: string) => {
    const res = await fetch('/api/riders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: true }),
    });
    return res.json();
  },
};
