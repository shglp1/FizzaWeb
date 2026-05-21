'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { notificationService } from '@/services/notificationService';

type NotifType = string;

type Notification = {
  id: string;
  title: string;
  message: string;
  type: NotifType;
  isRead: boolean;
  createdAt: string;
};

const TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  SUBSCRIPTION:          { label: 'Subscription',         color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  SUBSCRIPTION_PAYMENT:  { label: 'Payment',              color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  SUBSCRIPTION_CANCELLED:{ label: 'Cancelled',            color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  PAYMENT:               { label: 'Payment',              color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  WALLET_TOP_UP:         { label: 'Wallet',               color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  TRIP:                  { label: 'Trip',                 color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  DRIVER_APPLICATION:    { label: 'Driver Application',   color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  SAFETY:                { label: 'Safety',               color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
  WALLET:                { label: 'Wallet',               color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200' },
  SYSTEM:                { label: 'System',               color: 'text-gray-700',    bg: 'bg-gray-50',    border: 'border-gray-200' },
};

const DEFAULT_TYPE = { label: 'Notification', color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const loadNotifications = (unread = unreadOnly) => {
    setLoading(true);
    notificationService
      .listNotifications({ unreadOnly: unread, limit: 50 })
      .then(
        (res: {
          data?: { notifications: Notification[]; unreadCount: number };
          error?: { message: string };
        }) => {
          if (res.data) {
            setNotifications(res.data.notifications);
            setUnreadCount(res.data.unreadCount);
          } else {
            setPageError(res.error?.message ?? 'Failed to load notifications.');
          }
          setLoading(false);
        },
      );
  };

  useEffect(() => { loadNotifications(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkRead = async (id: string) => {
    setMarkingId(id);
    await notificationService.markRead(id);
    setMarkingId(null);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    await notificationService.markAllRead();
    setMarkingAll(false);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleFilterToggle = () => {
    const next = !unreadOnly;
    setUnreadOnly(next);
    loadNotifications(next);
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFilterToggle}
            className={`text-sm px-3 py-1.5 rounded-xl border font-medium transition-colors ${
              unreadOnly
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {unreadOnly ? 'Show All' : 'Unread Only'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="text-sm px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              {markingAll ? 'Marking…' : 'Mark All Read'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading notifications…</div>
      ) : pageError ? (
        <div className="card text-red-600 text-sm">{pageError}</div>
      ) : notifications.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg mb-2">
            {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          </p>
          <p className="text-gray-400 text-sm">
            Notifications for payments, trips, safety reports, and more will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const cfg = TYPE_CFG[notif.type] ?? DEFAULT_TYPE;
            return (
              <div
                key={notif.id}
                className={`rounded-2xl border px-4 py-3 flex items-start gap-3 transition-opacity ${
                  notif.isRead ? 'bg-white border-gray-100 opacity-70' : 'bg-white border-gray-200 shadow-sm'
                }`}
              >
                {!notif.isRead && (
                  <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{notif.message}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(notif.createdAt).toLocaleString()}</p>
                </div>
                {!notif.isRead && (
                  <button
                    onClick={() => handleMarkRead(notif.id)}
                    disabled={markingId === notif.id}
                    className="text-xs text-gray-400 hover:text-emerald-600 shrink-0 mt-0.5 disabled:opacity-50"
                    title="Mark as read"
                  >
                    {markingId === notif.id ? '…' : '✓'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
