export const authService = {
  login: async (email: string, password: string) => {
    const res = await fetch('/api/php/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email, password })
    });
    return res.json();
  },
  register: async (email: string, password: string, fullName: string, phone: string) => {
    const res = await fetch('/api/php/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', email, password, fullName, phone })
    });
    return res.json();
  },
  logout: async () => {
    const res = await fetch('/api/php/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' })
    });
    return res.json();
  },
  resetPassword: async (email: string) => {
    const res = await fetch('/api/php/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset-password', email })
    });
    return res.json();
  }
};
