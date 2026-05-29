'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button, Alert, StatusBadge } from '@/components/ui';
import { TripDetailDrawer } from '@/components/admin/TripDetailDrawer';
import { AdminPagination } from '@/components/admin/AdminPagination';
import {
  AdminSectionHeader,
  AdminDataCard,
  AdminEmptyState,
  AdminSectionLoading,
} from '@/components/admin/AdminUI';
import { tripService } from '@/services/tripService';
import { normalizeAdminTripDetail, type NormalizedAdminTripDetail } from '@/lib/ui/adminTripDetail';
import { formatTripDateTime } from '@/lib/ui/adminTrips';
import { DEFAULT_ADMIN_PAGE_LIMIT } from '@/lib/ui/adminPagination';

type QueueTrip = {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  financialReviewStatus: string | null;
  financialReviewReason: string | null;
  walletCreditTransactionId?: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  billableKmOverride?: string | null;
  rider: { name: string } | null;
  driver: { profile: { fullName: string } | null } | null;
  subscription?: { user?: { fullName: string } | null } | null;
};

type QueueTab = 'pending' | 'payment_action';

const DECISION_GUIDE = [
  { key: 'PAY_DRIVER', label: 'Pay driver', impact: 'Driver eligible for payroll.' },
  { key: 'NO_PAY_DRIVER', label: 'Do not pay driver', impact: 'Driver excluded from payroll.' },
  { key: 'REFUND_PARENT', label: 'Refund parent (record)', impact: 'Audit only — manual payment gateway refund required. Driver not paid.' },
  { key: 'CREDIT_PARENT', label: 'Credit parent wallet', impact: 'Automated internal wallet credit (idempotent). Driver not paid.' },
  { key: 'KEEP_REVENUE', label: 'Keep revenue', impact: 'Fizza keeps revenue; driver paid if trip valid.' },
  { key: 'INCIDENT', label: 'Incident', impact: 'Not payable until explicitly resolved with Pay driver.' },
] as const;

export function FinancialReviewSection() {
  const [tab, setTab] = useState<QueueTab>('pending');
  const [trips, setTrips] = useState<QueueTrip[]>([]);
  const [meta, setMeta] = useState<{ page: number; limit: number; total: number; totalPages: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NormalizedAdminTripDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    const filters = tab === 'pending'
      ? { financialReviewStatus: 'PENDING', page, limit: DEFAULT_ADMIN_PAGE_LIMIT }
      : { paymentActionRequired: true, page, limit: DEFAULT_ADMIN_PAGE_LIMIT };
    const res = await tripService.adminList(filters);
    if (res.data?.trips) {
      setTrips(res.data.trips as QueueTrip[]);
      setMeta(res.data.meta ?? null);
    } else {
      setError(res.error?.message ?? 'Failed to load financial review queue');
    }
    setLoading(false);
  }, [tab, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError('');
      return;
    }
    setDetailLoading(true);
    setDetailError('');
    tripService.adminGetTrip(selectedId).then((res) => {
      if (res.data?.trip) setDetail(normalizeAdminTripDetail(res.data));
      else {
        setDetail(null);
        setDetailError(res.error?.message ?? 'Failed to load trip.');
      }
      setDetailLoading(false);
    }).catch(() => {
      setDetail(null);
      setDetailError('Failed to load trip.');
      setDetailLoading(false);
    });
  }, [selectedId]);

  return (
    <div className="space-y-5">
      {toast && (
        <Alert variant={toast.type} onClose={() => setToast(null)}>{toast.text}</Alert>
      )}

      <AdminSectionHeader
        title="Financial Review"
        subtitle="Resolve payroll-held trips and record refund/credit decisions"
        primaryAction={(
          <Button variant="ghost" size="sm" onClick={load} className="min-h-[44px]">
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden /> Refresh
          </Button>
        )}
      />

      <Alert variant="info">
        <p className="text-sm font-medium">Refund vs wallet credit</p>
        <p className="text-xs mt-1">
          <strong>CREDIT_PARENT</strong> credits the parent internal wallet automatically (idempotent).
          <strong> REFUND_PARENT</strong> records a gateway refund decision only — process MyFatoorah/card refund manually.
          Manual adjustments are available under Users → parent wallet.
        </p>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm font-medium min-h-[44px] ${tab === 'pending' ? 'bg-fizza-primary text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => { setTab('pending'); setPage(1); }}
        >
          Pending review
        </button>
        <button
          type="button"
          className={`px-4 py-2 rounded-xl text-sm font-medium min-h-[44px] ${tab === 'payment_action' ? 'bg-fizza-primary text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => { setTab('payment_action'); setPage(1); }}
        >
          Payment action required
        </button>
      </div>

      <AdminDataCard title="Decision guide">
        <ul className="space-y-2 text-sm text-gray-600">
          {DECISION_GUIDE.map((d) => (
            <li key={d.key}>
              <span className="font-medium text-gray-800">{d.label}:</span> {d.impact}
            </li>
          ))}
        </ul>
      </AdminDataCard>

      {loading ? (
        <AdminSectionLoading message="Loading financial review queue…" />
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : trips.length === 0 ? (
        <AdminEmptyState
          icon={AlertTriangle}
          title={tab === 'pending' ? 'No trips awaiting financial review' : 'No trips requiring manual payment action'}
          description={tab === 'pending'
            ? 'Completed trips flagged for payroll review will appear here.'
            : 'Trips marked refund parent or uncredited credit parent appear here until resolved.'}
        />
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => (
            <button
              key={trip.id}
              type="button"
              className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 shadow-card hover:border-fizza-primary/30 transition-colors"
              onClick={() => setSelectedId(trip.id)}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">
                    {trip.rider?.name ?? 'Trip'} · {trip.subscription?.user?.fullName ?? 'Parent'}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {formatTripDateTime(trip.scheduledDate, trip.scheduledPickupTime)}
                    {' · '}{trip.driver?.profile?.fullName ?? 'No driver'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {trip.pickupLocation} → {trip.dropoffLocation}
                  </p>
                  {trip.financialReviewReason && (
                    <p className="text-xs text-amber-800 bg-amber-50 rounded px-2 py-1 mt-2 inline-block">
                      {trip.financialReviewReason}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <StatusBadge variant={tab === 'payment_action' ? 'warning' : 'orange'}>
                    {tab === 'payment_action'
                      ? (trip.financialReviewStatus === 'CREDIT_PARENT' && trip.walletCreditTransactionId
                          ? 'Wallet credit processed'
                          : 'Payment action required')
                      : 'Review pending'}
                  </StatusBadge>
                  {trip.financialReviewStatus && tab === 'payment_action' && (
                    <StatusBadge variant="purple">{trip.financialReviewStatus.replace(/_/g, ' ')}</StatusBadge>
                  )}
                  <span className="text-[10px] text-gray-400">{trip.status}</span>
                </div>
              </div>
            </button>
          ))}
          {meta && meta.totalPages > 1 && (
            <AdminPagination
              meta={meta}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {selectedId && detailLoading && (
        <AdminSectionLoading message="Loading trip details…" />
      )}
      {selectedId && detailError && (
        <Alert variant="error">{detailError}</Alert>
      )}
      {selectedId && detail && !detailLoading && (
        <TripDetailDrawer
          open={!!selectedId}
          tripId={selectedId}
          detail={detail}
          onClose={() => setSelectedId(null)}
          onReviewResolved={() => {
            setToast({ text: 'Financial review saved.', type: 'success' });
            load();
            if (selectedId) {
              tripService.adminGetTrip(selectedId).then((res) => {
                if (res.data?.trip) setDetail(normalizeAdminTripDetail(res.data));
              });
            }
          }}
        />
      )}
    </div>
  );
}
