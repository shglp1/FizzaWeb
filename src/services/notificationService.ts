export const notificationService = {
  listNotifications: async (filters?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.unreadOnly) params.set('unreadOnly', 'true');
    if (filters?.type) params.set('type', filters.type);
    const res = await fetch(`/api/notifications?${params}`);
    return res.json();
  },

  markRead: async (id: string) => {
    const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
    });
    return res.json();
  },

  markAllRead: async () => {
    const res = await fetch('/api/notifications/read-all', { method: 'PATCH' });
    return res.json();
  },
};
