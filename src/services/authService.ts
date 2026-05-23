import { clearCurrentUserCache } from '@/hooks/useCurrentUser';

export const authService = {
  login: async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (json.data) clearCurrentUserCache();
    return json;
  },
  register: async (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    registrationSource: 'FAMILY' | 'DRIVER_PORTAL' = 'FAMILY',
  ) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, phone, registrationSource }),
    });
    const json = await res.json();
    if (json.data) clearCurrentUserCache();
    return json;
  },
  logout: async () => {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    clearCurrentUserCache();
    return res.json();
  },
  resetPassword: async (email: string) => {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },
};
