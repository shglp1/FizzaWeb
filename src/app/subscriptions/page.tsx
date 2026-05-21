'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { subscriptionService } from '@/services/subscriptionService';

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

const STATUS_CFG: Record<SubscriptionStatus, { label: string; color: string; bg: string; border: string }> = {
  PENDING:   { label: 'Pending Payment', color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  ACTIVE:    { label: 'Active',          color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  PAUSED:    { label: 'Paused',          color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  EXPIRED:   { label: 'Expired',         color: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-200' },
  CANCELLED: { label: 'Cancelled',       color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState('');

  const loadSubscriptions = () => {
    setLoading(true);
    subscriptionService.list().then((res) => {
      if (res.data) setSubscriptions(res.data);
      else setPageError(res.error?.message ?? 'Failed to load subscriptions.');
      setLoading(false);
    });
  };

  useEffect(() => { loadSubscriptions(); }, []);

  const handleCancel = async (sub: Subscription) => {
    if (!confirm(`Cancel your ${sub.subscriptionType} subscription?`)) return;
    setCancelling(sub.id);
    setActionMsg('');
    const res = await subscriptionService.cancel(sub.id);
    setCancelling(null);
    if (res.data) {
      setActionMsg('Subscription cancelled successfully.');
      loadSubscriptions();
    } else {
      setActionMsg(res.error?.message ?? 'Cancel failed.');
    }
  };

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">My Subscriptions</h1>
        <Link href="/subscriptions/new" className="btn-primary text-sm px-4 py-2 rounded-xl">
          + New Subscription
        </Link>
      </div>

      {actionMsg && (
        <p className={`rounded-xl px-4 py-3 text-sm mb-4 ${
          actionMsg.includes('failed') || actionMsg.includes('Failed')
            ? 'text-red-700 bg-red-50'
            : 'text-emerald-700 bg-emerald-50'
        }`}>
          {actionMsg}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading subscriptions…</div>
      ) : pageError ? (
        <div className="card text-red-600 text-sm">{pageError}</div>
      ) : subscriptions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No subscriptions yet</p>
          <p className="text-gray-400 text-sm mb-4">
            Set up a school or university transport subscription for your family.
          </p>
          <Link href="/subscriptions/new" className="btn-primary text-sm px-4 py-2 rounded-xl">
            Create First Subscription
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {subscriptions.map((sub) => {
            const cfg = STATUS_CFG[sub.status];
            const activeDays = sub.schedules
              .filter((s) => !s.isOffDay)
              .map((s) => WEEKDAY_LABELS[s.weekday])
              .join(', ');

            return (
              <div key={sub.id} className="card">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="font-semibold text-base capitalize">{sub.subscriptionType} Subscription</h2>
                    {sub.package && (
                      <p className="text-sm text-gray-500">
                        {sub.package.name} — {Number(sub.package.priceSar).toLocaleString()} SAR / {sub.package.billingCycle}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                    {sub.paymentStatus !== 'PAID' && sub.status !== 'CANCELLED' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        Payment {sub.paymentStatus.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-700 mb-3">
                  {sub.rider && (
                    <p><span className="text-gray-400">Rider:</span> {sub.rider.name} ({sub.rider.relationship})</p>
                  )}
                  <p><span className="text-gray-400">Pickup:</span> {sub.pickupTime} — {sub.pickupLocation}</p>
                  <p><span className="text-gray-400">Return:</span> {sub.returnTime} — {sub.dropoffLocation}</p>
                  {activeDays && (
                    <p><span className="text-gray-400">Days:</span> {activeDays}</p>
                  )}
                  {sub.startsOn && (
                    <p><span className="text-gray-400">Starts:</span> {new Date(sub.startsOn).toLocaleDateString()}</p>
                  )}
                  {sub.femaleDriverPreference && (
                    <p className="text-emerald-600 font-medium">Female driver preferred ✓</p>
                  )}
                </div>

                {sub.addOns.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {sub.addOns.map((a) => (
                      <span key={a.id} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200">
                        {a.addOn.name} (+{Number(a.addOn.priceSar)} SAR)
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-400 mb-3">
                  Created {new Date(sub.createdAt).toLocaleDateString()}
                  {sub.autoRenewal && ' · Auto-renewal on'}
                </p>

                {(sub.status === 'PENDING' || sub.status === 'ACTIVE' || sub.status === 'PAUSED') && (
                  <div className="border-t border-gray-100 pt-3 flex gap-2">
                    <button
                      onClick={() => handleCancel(sub)}
                      disabled={cancelling === sub.id}
                      className="text-sm px-4 py-2 rounded-xl font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {cancelling === sub.id ? 'Cancelling…' : 'Cancel Subscription'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
