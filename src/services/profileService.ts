export const profileService = {
  get: async () => {
    const res = await fetch('/api/profile');
    return res.json();
  },
  update: async (payload: { fullName?: string; phone?: string; avatarUrl?: string }) => {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};
