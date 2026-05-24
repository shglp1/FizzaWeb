'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  LoadingState,
  ErrorState,
  EmptyState,
} from '@/components/ui';
import { notificationService } from '@/services/notificationService';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Car,
  ClipboardList,
  CreditCard,
  FileText,
  Settings,
  Shield,
  Wallet,
  XCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

const TYPE_META: Record<string, { variant: 'info' | 'success' | 'danger' | 'warning' | 'purple' | 'orange' | 'gray'; Icon: LucideIcon; label: string }> = {
  SUBSCRIPTION:           { variant: 'info',    Icon: ClipboardList, label: 'Subscription' },
  SUBSCRIPTION_PAYMENT:   { variant: 'success', Icon: CreditCard, label: 'Payment' },
  SUBSCRIPTION_CANCELLED: { variant: 'danger',  Icon: XCircle, label: 'Cancelled' },
  PAYMENT:                { variant: 'success', Icon: CreditCard, label: 'Payment' },
  WALLET_TOP_UP:          { variant: 'success', Icon: Wallet, label: 'Wallet' },
  TRIP:                   { variant: 'purple',  Icon: Car, label: 'Trip' },
  DRIVER_APPLICATION:     { variant: 'orange',  Icon: FileText, label: 'Application' },
  SAFETY:                 { variant: 'danger',  Icon: Shield, label: 'Safety' },
  WALLET:                 { variant: 'info',    Icon: Wallet, label: 'Wallet' },
  SYSTEM:                 { variant: 'gray',    Icon: Settings, label: 'System' },
};

const DEFAULT_META = { variant: 'gray' as const, Icon: Bell, label: 'Notification' };

function fmtDate(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)   return 'Just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24)   return `${diffHrs}h ago`;
  return d.toLocaleDateString('en-SA', { month: 'short', day: 'numeric' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  const [pageError, setPageError]         = useState('');
  const [markingId, setMarkingId]         = useState<string | null>(null);
  const [markingAll, setMarkingAll]       = useState(false);
  const [unreadOnly, setUnreadOnly]       = useState(false);

  const loadNotifications = (unread = unreadOnly) => {
    setLoading(true);
    notificationService
      .listNotifications({ unreadOnly: unread, limit: 50 })
      .then((res: { data?: { notifications: Notification[]; unreadCount: number }; error?: { message: string } }) => {
        if (res.data) {
          setNotifications(res.data.notifications);
          setUnreadCount(res.data.unreadCount);
        } else {
          setPageError(res.error?.message ?? 'Failed to load notifications.');
        }
        setLoading(false);
      });
  };

  useEffect(() => { loadNotifications(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkRead = async (id: string) => {
    setMarkingId(id);
    await notificationService.markRead(id);
    setMarkingId(null);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
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
      <PageHeader
        title={
          unreadCount > 0
            ? `Notifications · ${unreadCount} unread`
            : 'Notifications'
        }
        subtitle="Stay up-to-date on trips, payments, and safety reports"
        action={
          <div className="flex gap-2">
            <Button
              variant={unreadOnly ? 'primary' : 'outline'}
              size="sm"
              onClick={handleFilterToggle}
            >
              {unreadOnly ? 'Show All' : 'Unread Only'}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                loading={markingAll}
                disabled={markingAll}
                onClick={handleMarkAll}
              >
                Mark All Read
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <LoadingState message="Loading notifications…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => loadNotifications()} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="bell"
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description="Notifications for payments, trips, safety reports, and more will appear here."
          action={unreadOnly ? { label: 'Show All', onClick: handleFilterToggle } : undefined}
        />
      ) : (
        <Card padding="sm">
          <div className="divide-y divide-gray-50">
            {notifications.map((notif) => {
              const meta = TYPE_META[notif.type] ?? DEFAULT_META;
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 px-2 py-3.5 transition-colors ${
                    notif.isRead ? 'opacity-60' : ''
                  }`}
                >
                  {/* Unread dot */}
                  <div className="mt-1 shrink-0 flex items-center justify-center w-5">
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-fizza-secondary" />
                    )}
                  </div>

                  {/* Icon */}
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 text-base ${notif.isRead ? 'bg-gray-100' : 'bg-emerald-50'}`}>
                    <meta.Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className={`text-sm font-semibold truncate ${notif.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
                        {notif.title}
                      </p>
                      <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{fmtDate(notif.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">{notif.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                    </div>
                  </div>

                  {/* Mark read button */}
                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkRead(notif.id)}
                      disabled={markingId === notif.id}
                      className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-fizza-secondary transition-colors disabled:opacity-50 mt-0.5"
                      title="Mark as read"
                      aria-label="Mark as read"
                    >
                      {markingId === notif.id ? (
                        <span className="animate-spin text-xs">⟳</span>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </AppShell>
  );
}
