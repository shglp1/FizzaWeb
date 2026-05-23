'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader,
  Card,
  Badge,
  StatusBadge,
  Button,
  Alert,
  LoadingState,
  ErrorState,
  EmptyState,
  ConfirmDialog,
} from '@/components/ui';
import { subscriptionService } from '@/services/subscriptionService';
import { walletService } from '@/services/walletService';
import { paymentService } from '@/services/paymentService';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

type Subscription = {
  id: string;
  subscriptionType: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupTime: string;
  returnTime: string;
  femaleDriverPreference: boolean;
  autoRenewal: boolean;
  paymentStatus: PaymentStatus;
  status: SubscriptionStatus;
  startsOn: string | null;
  endsOn: string | null;
  createdAt: string;
  rider: { id: string; name: string; relationship: string; school: string | null } | null;
  package: { id: string; name: string; billingCycle: string; priceSar: string } | null;
  schedules: { id: string; weekday: number; isOffDay: boolean }[];
  addOns: { id: string; addOn: { id: string; name: string; priceSar: string } }[];
};

const STATUS_VARIANT: Record<SubscriptionStatus, 'success' | 'warning' | 'info' | 'gray' | 'danger'> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  PAUSED: 'info',
  EXPIRED: 'gray',
  CANCELLED: 'danger',
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  PENDING: 'Pending Payment',
  PAUSED: 'Paused',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Subscription card ────────────────────────────────────────────────────────

function SubCard({
  sub,
  onCancel,
  onPayWallet,
  onPayOnline,
  onVerifyPayment,
  cancelling,
  paying,
  verifying,
  pendingInvoiceId,
}: {
  sub: Subscription;
  onCancel: () => void;
  onPayWallet: () => void;
  onPayOnline: () => void;
  onVerifyPayment: () => void;
  cancelling: boolean;
  paying: boolean;
  verifying: boolean;
  pendingInvoiceId: string | null;
}) {
  const activeDays = sub.schedules
    .filter((s) => !s.isOffDay)
    .map((s) => WEEKDAY_LABELS[s.weekday])
    .join(', ');

  const canPay = sub.paymentStatus === 'PENDING';
  const canCancel = ['PENDING', 'ACTIVE', 'PAUSED'].includes(sub.status);
  const busy = cancelling || paying || verifying;

  return (
    <Card>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-lg shrink-0">
            {sub.subscriptionType === 'SCHOOL' ? '🏫' : '🎓'}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 capitalize">{sub.subscriptionType.toLowerCase()} Subscription</h2>
            {sub.package && (
              <p className="text-sm text-gray-500">
                {sub.package.name} · <span className="font-medium text-gray-700">SAR {Number(sub.package.priceSar).toLocaleString()}</span>
                <span className="text-gray-400"> / {sub.package.billingCycle.toLowerCase()}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusBadge variant={STATUS_VARIANT[sub.status]}>
            {STATUS_LABEL[sub.status]}
          </StatusBadge>
          {sub.paymentStatus !== 'PAID' && sub.status !== 'CANCELLED' && (
            <Badge variant="warning" className="text-[10px]">
              Payment {sub.paymentStatus.toLowerCase()}
            </Badge>
          )}
        </div>
      </div>

      {/* Details grid */}
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-700 mb-4">
        {sub.rider && (
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Rider</span>
            <span className="font-medium">{sub.rider.name} <span className="text-gray-400 font-normal">({sub.rider.relationship})</span></span>
          </div>
        )}
        <div className="flex gap-1.5">
          <span className="text-gray-400 shrink-0">Pickup</span>
          <span>{sub.pickupTime} · {sub.pickupLocation}</span>
        </div>
        <div className="flex gap-1.5">
          <span className="text-gray-400 shrink-0">Return</span>
          <span>{sub.returnTime} · {sub.dropoffLocation}</span>
        </div>
        {activeDays && (
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Days</span>
            <span>{activeDays}</span>
          </div>
        )}
        {sub.startsOn && (
          <div className="flex gap-1.5">
            <span className="text-gray-400 shrink-0">Starts</span>
            <span>{new Date(sub.startsOn).toLocaleDateString()}</span>
          </div>
        )}
        {sub.femaleDriverPreference && (
          <div className="flex gap-1.5 text-fizza-secondary">
            <span>✓</span>
            <span className="font-medium">Female driver preferred</span>
          </div>
        )}
      </div>

      {/* Add-ons */}
      {sub.addOns.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {sub.addOns.map((a) => (
            <Badge key={a.id} variant="info">
              {a.addOn.name} · +SAR {Number(a.addOn.priceSar)}
            </Badge>
          ))}
        </div>
      )}

      {/* Meta */}
      <p className="text-xs text-gray-400 mb-4">
        Created {new Date(sub.createdAt).toLocaleDateString()}
        {sub.autoRenewal && ' · Auto-renewal enabled'}
      </p>

      {/* Actions */}
      {canCancel && (
        <div className="border-t border-gray-50 pt-3 space-y-2">
          {canPay && (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" loading={paying} disabled={busy} onClick={onPayWallet}>
                Pay with Wallet
              </Button>
              <Button variant="outline" size="sm" loading={paying} disabled={busy} onClick={onPayOnline}>
                Pay Online
              </Button>
              {pendingInvoiceId && (
                <Button
                  variant="outline"
                  size="sm"
                  loading={verifying}
                  disabled={busy}
                  onClick={onVerifyPayment}
                  title="Check if a previous payment was already completed"
                >
                  Verify Payment
                </Button>
              )}
            </div>
          )}
          <div>
            <Button variant="danger-outline" size="sm" disabled={busy} loading={cancelling} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  // Map of subscriptionId → pending invoiceId (populated when createPayment returns PENDING)
  const [pendingInvoiceIds, setPendingInvoiceIds] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Subscription | null>(null);

  const loadSubscriptions = () => {
    setLoading(true);
    subscriptionService.list().then((res: { data?: Subscription[]; error?: { message: string } }) => {
      if (res.data) setSubscriptions(res.data);
      else setPageError(res.error?.message ?? 'Failed to load subscriptions.');
      setLoading(false);
    });
  };

  useEffect(() => { loadSubscriptions(); }, []);

  const doCancel = async () => {
    if (!confirmCancel) return;
    const sub = confirmCancel;
    setConfirmCancel(null);
    setCancelling(sub.id);
    const res = await subscriptionService.cancel(sub.id);
    setCancelling(null);
    if (res.data) {
      setActionMsg({ text: 'Subscription cancelled.', type: 'success' });
      loadSubscriptions();
    } else {
      setActionMsg({ text: res.error?.message ?? 'Cancel failed.', type: 'error' });
    }
  };

  const handlePayWithWallet = async (sub: Subscription) => {
    setPaying(sub.id);
    setActionMsg(null);
    const res = await walletService.paySubscription(sub.id);
    setPaying(null);
    if (res.data) {
      setActionMsg({ text: 'Subscription paid — now active!', type: 'success' });
      loadSubscriptions();
    } else {
      setActionMsg({ text: res.error?.message ?? 'Payment failed.', type: 'error' });
    }
  };

  const handlePayOnline = async (sub: Subscription) => {
    setPaying(sub.id);
    setActionMsg(null);
    const res = await paymentService.createPayment({ purpose: 'SUBSCRIPTION_PAYMENT', subscriptionId: sub.id });
    setPaying(null);
    if (res.data?.invoiceUrl) {
      window.location.href = res.data.invoiceUrl;
    } else if (res.data?.invoiceId) {
      // Payment already exists as PENDING — store the invoiceId so we can show Verify button
      setPendingInvoiceIds((prev) => ({ ...prev, [sub.id]: res.data.invoiceId as string }));
      setActionMsg({
        text: 'A payment is already in progress. Use "Verify Payment" to check if it completed.',
        type: 'error',
      });
    } else {
      setActionMsg({ text: res.error?.message ?? 'Failed to initiate payment.', type: 'error' });
    }
  };

  const handleVerifyPayment = async (sub: Subscription) => {
    const invoiceId = pendingInvoiceIds[sub.id];
    if (!invoiceId) return;
    setVerifying(sub.id);
    setActionMsg(null);
    const res = await paymentService.verifyPayment({ invoiceId });
    setVerifying(null);
    if (res.data) {
      const { outcome } = res.data as { outcome: string };
      if (outcome === 'PAID' || outcome === 'ALREADY_PROCESSED') {
        setActionMsg({ text: 'Payment confirmed — subscription is now active!', type: 'success' });
        setPendingInvoiceIds((prev) => {
          const next = { ...prev };
          delete next[sub.id];
          return next;
        });
        loadSubscriptions();
      } else if (outcome === 'PENDING') {
        setActionMsg({
          text: 'Payment is still being processed by the bank. Please try again in a moment.',
          type: 'error',
        });
      } else {
        setActionMsg({ text: 'Payment failed. Please try a new payment.', type: 'error' });
        setPendingInvoiceIds((prev) => {
          const next = { ...prev };
          delete next[sub.id];
          return next;
        });
      }
    } else {
      setActionMsg({ text: res.error?.message ?? 'Unable to verify payment.', type: 'error' });
    }
  };

  const active = subscriptions.filter((s) => s.status === 'ACTIVE').length;

  return (
    <AppShell>
      <PageHeader
        title="My Subscriptions"
        subtitle={subscriptions.length > 0 ? `${active} active · ${subscriptions.length} total` : 'Manage your transport plans'}
        action={
          <Link href="/subscriptions/new" className="btn-primary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Subscription
          </Link>
        }
      />

      {actionMsg && (
        <Alert variant={actionMsg.type} className="mb-4" onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}

      {loading ? (
        <LoadingState message="Loading subscriptions…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={loadSubscriptions} />
      ) : subscriptions.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No subscriptions yet"
          description="Set up a school or university transport plan for your family."
          action={{ label: 'Create First Subscription', onClick: () => window.location.assign('/subscriptions/new') }}
        />
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => (
            <SubCard
              key={sub.id}
              sub={sub}
              onCancel={() => setConfirmCancel(sub)}
              onPayWallet={() => handlePayWithWallet(sub)}
              onPayOnline={() => handlePayOnline(sub)}
              onVerifyPayment={() => handleVerifyPayment(sub)}
              cancelling={cancelling === sub.id}
              paying={paying === sub.id}
              verifying={verifying === sub.id}
              pendingInvoiceId={pendingInvoiceIds[sub.id] ?? null}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmCancel}
        title="Cancel Subscription?"
        message={`This will cancel your ${confirmCancel?.subscriptionType?.toLowerCase() ?? ''} subscription. This action cannot be undone.`}
        confirmLabel="Cancel Subscription"
        confirmVariant="danger"
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(null)}
      />
    </AppShell>
  );
}
