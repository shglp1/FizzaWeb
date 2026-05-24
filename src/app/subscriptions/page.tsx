'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  ParentPageHeader,
  ParentFilterTabs,
  ParentSubscriptionCard,
  ParentDriverBlock,
  ParentEmptyState,
  ParentLoadingState,
  ParentErrorState,
} from '@/components/parent/ParentUI';
import { Badge, StatusBadge, Button, Alert, ConfirmDialog } from '@/components/ui';
import { subscriptionService } from '@/services/subscriptionService';
import { walletService } from '@/services/walletService';
import { paymentService } from '@/services/paymentService';
import {
  formatSarParent,
  formatSubscriptionRoute,
  formatServiceDays,
  formatDriverSummary,
  formatVehicleSummary,
} from '@/lib/parent/parentFormatters';

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
  finalPriceSar?: string | null;
  rider: { id: string; name: string; relationship: string; school: string | null } | null;
  package: { id: string; name: string; billingCycle: string; priceSar: string } | null;
  schedules: { id: string; weekday: number; isOffDay: boolean }[];
  addOns: { id: string; addOn: { id: string; name: string; priceSar: string } }[];
  assignedDriver?: {
    id: string;
    rating: string | null;
    profile: { fullName: string; avatarUrl: string | null; phone: string | null } | null;
    vehicle: { model: string; color: string | null; plateNumber: string; capacity: number | null } | null;
  } | null;
};

const FILTER_TABS = [
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'Pending' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
];

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

function filterSubscriptions(subs: Subscription[], tab: string): Subscription[] {
  switch (tab) {
    case 'active':
      return subs.filter((s) => s.status === 'ACTIVE');
    case 'pending':
      return subs.filter((s) => s.status === 'PENDING' || s.paymentStatus === 'PENDING');
    case 'cancelled':
      return subs.filter((s) => s.status === 'CANCELLED');
    default:
      return subs;
  }
}

function planName(sub: Subscription): string {
  const type = sub.subscriptionType.charAt(0) + sub.subscriptionType.slice(1).toLowerCase();
  return sub.package ? `${sub.package.name}` : `${type} subscription`;
}

function riderLabel(sub: Subscription): string {
  if (!sub.rider) return 'No rider assigned';
  const parts = [sub.rider.name, sub.rider.relationship];
  if (sub.rider.school) parts.push(sub.rider.school);
  return parts.join(' · ');
}

function scheduleLabel(sub: Subscription): string {
  const pickup = `${sub.pickupTime} pickup`;
  const ret = `${sub.returnTime} return`;
  return `${pickup} · ${ret}`;
}

function priceLabel(sub: Subscription): string {
  if (sub.finalPriceSar) return `${formatSarParent(sub.finalPriceSar)} / cycle`;
  if (sub.package) {
    return `${formatSarParent(sub.package.priceSar)} / ${sub.package.billingCycle.toLowerCase()}`;
  }
  return 'Price pending';
}

function addOnsLabel(sub: Subscription): string | undefined {
  if (!sub.addOns.length) return undefined;
  return sub.addOns.map((a) => `${a.addOn.name} (+${formatSarParent(a.addOn.priceSar)})`).join(', ');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [activeTab, setActiveTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
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

  const filtered = useMemo(
    () => filterSubscriptions(subscriptions, activeTab),
    [subscriptions, activeTab],
  );

  const tabsWithCounts = useMemo(() => {
    return FILTER_TABS.map((t) => ({
      ...t,
      count: filterSubscriptions(subscriptions, t.id).length,
    }));
  }, [subscriptions]);

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

  const activeCount = subscriptions.filter((s) => s.status === 'ACTIVE').length;

  return (
    <AppShell>
      <ParentPageHeader
        title="My Subscriptions"
        subtitle={subscriptions.length > 0 ? `${activeCount} active · ${subscriptions.length} total` : 'Manage your transport plans'}
        action={
          <Link href="/subscriptions/new">
            <Button variant="primary" size="sm">New Subscription</Button>
          </Link>
        }
      />

      {actionMsg && (
        <Alert variant={actionMsg.type} className="mb-4" onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}

      {!loading && !pageError && subscriptions.length > 0 && (
        <div className="mb-5">
          <ParentFilterTabs
            tabs={tabsWithCounts}
            active={activeTab}
            onChange={setActiveTab}
          />
        </div>
      )}

      {loading ? (
        <ParentLoadingState message="Loading subscriptions…" />
      ) : pageError ? (
        <ParentErrorState message={pageError} onRetry={loadSubscriptions} />
      ) : subscriptions.length === 0 ? (
        <ParentEmptyState
          icon={ClipboardList}
          title="No subscriptions yet"
          description="Set up a school or university transport plan for your family."
          action={
            <Link href="/subscriptions/new">
              <Button variant="primary" size="sm">Create First Subscription</Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <ParentEmptyState
          icon={ClipboardList}
          title={`No ${activeTab} subscriptions`}
          description="Try another filter or create a new subscription."
          action={
            activeTab !== 'all' ? (
              <Button variant="outline" size="sm" onClick={() => setActiveTab('all')}>Show all</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((sub) => {
            const canPay = sub.paymentStatus === 'PENDING';
            const canCancel = ['PENDING', 'ACTIVE', 'PAUSED'].includes(sub.status);
            const busy = cancelling === sub.id || paying === sub.id || verifying === sub.id;
            const driverInfo = formatDriverSummary(sub.assignedDriver);
            const vehicleStr = sub.assignedDriver?.vehicle
              ? formatVehicleSummary(sub.assignedDriver.vehicle)
              : undefined;

            return (
              <ParentSubscriptionCard
                key={sub.id}
                planName={planName(sub)}
                statusBadge={
                  <StatusBadge variant={STATUS_VARIANT[sub.status]}>
                    {STATUS_LABEL[sub.status]}
                  </StatusBadge>
                }
                paymentBadge={
                  sub.paymentStatus !== 'PAID' && sub.status !== 'CANCELLED' ? (
                    <Badge variant="warning" className="text-[10px]">
                      Payment {sub.paymentStatus.toLowerCase()}
                    </Badge>
                  ) : undefined
                }
                riders={riderLabel(sub)}
                route={formatSubscriptionRoute(sub.pickupLocation, sub.dropoffLocation)}
                schedule={scheduleLabel(sub)}
                serviceDays={formatServiceDays(sub.schedules)}
                driver={
                  sub.assignedDriver ? (
                    <ParentDriverBlock
                      name={driverInfo.name}
                      rating={driverInfo.rating}
                      avatarUrl={driverInfo.avatarUrl}
                    />
                  ) : undefined
                }
                vehicle={vehicleStr}
                price={priceLabel(sub)}
                addOns={addOnsLabel(sub)}
                actions={
                  canCancel ? (
                    <>
                      {canPay && (
                        <>
                          <Button variant="primary" size="sm" loading={paying === sub.id} disabled={busy} onClick={() => handlePayWithWallet(sub)}>
                            Pay with Wallet
                          </Button>
                          <Button variant="outline" size="sm" loading={paying === sub.id} disabled={busy} onClick={() => handlePayOnline(sub)}>
                            Pay Online
                          </Button>
                          {pendingInvoiceIds[sub.id] && (
                            <Button
                              variant="outline"
                              size="sm"
                              loading={verifying === sub.id}
                              disabled={busy}
                              onClick={() => handleVerifyPayment(sub)}
                              title="Check if a previous payment was already completed"
                            >
                              Verify Payment
                            </Button>
                          )}
                        </>
                      )}
                      <Button variant="danger-outline" size="sm" disabled={busy} loading={cancelling === sub.id} onClick={() => setConfirmCancel(sub)}>
                        Cancel
                      </Button>
                    </>
                  ) : undefined
                }
              />
            );
          })}
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
