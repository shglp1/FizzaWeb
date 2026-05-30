'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Alert, Input, Textarea, StatusBadge } from '@/components/ui';
import { adminFinancialService } from '@/services/adminService';
import { formatWallet } from '@/lib/ui/adminCurrency';
import { formatWalletTransactionAdmin } from '@/lib/ui/walletTransactionDisplay';
import { AdminDrawerSection } from '@/components/admin/AdminUI';

const SOURCE_LABELS: Record<string, string> = {
  TRIP_FINANCIAL_CREDIT: 'Automated trip credit',
  MANUAL_ADJUSTMENT: 'Manual admin adjustment',
  SUBSCRIPTION_PAYMENT: 'Subscription payment',
  TOP_UP: 'Wallet top-up',
  REFUND_MANUAL_PENDING: 'Gateway refund pending/manual',
};

type WalletTx = {
  id: string;
  amountSar: string | number;
  txType: string;
  source?: string;
  reason?: string | null;
  description?: string | null;
  createdAt: string;
  tripId?: string | null;
  adminUserId?: string | null;
  adminUser?: {
    id: string;
    fullName: string;
    user?: { email: string | null } | null;
  } | null;
};

type Props = {
  userId: string;
  userName: string;
  initialBalance?: string | number | null;
  onAdjusted?: () => void;
};

export function WalletAdminPanel({ userId, userName, initialBalance, onAdjusted }: Props) {
  const [balance, setBalance] = useState<number>(Number(initialBalance ?? 0));
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [tripId, setTripId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminFinancialService.walletTransactions({ userId, limit: 20 });
    if (res.data?.transactions) {
      setTransactions(res.data.transactions as WalletTx[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function submitAdjustment(sign: 1 | -1) {
    setError('');
    setSuccess('');
    const amountSar = sign * Math.abs(Number(amount));
    if (!Number.isFinite(amountSar) || amountSar === 0) {
      setError('Enter a valid non-zero amount.');
      return;
    }
    if (reason.trim().length < 10) {
      setError('Reason must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    const res = await adminFinancialService.adjustWallet(
      userId,
      amountSar,
      reason.trim(),
      tripId.trim() || undefined,
    );
    setSubmitting(false);
    if (res.data) {
      setSuccess(`Wallet updated. New balance: ${formatWallet(res.data.newBalanceSar)}`);
      setBalance(Number(res.data.newBalanceSar));
      setAmount('');
      setReason('');
      setTripId('');
      load();
      onAdjusted?.();
    } else {
      setError(res.error?.message ?? 'Adjustment failed.');
    }
  }

  return (
    <AdminDrawerSection title="Wallet operations">
      <p className="text-sm text-gray-600 mb-3">
        Parent: <span className="font-medium">{userName}</span> · Balance:{' '}
        <span className="font-semibold tabular-nums">{formatWallet(balance)}</span>
      </p>

      <Alert variant="info" className="mb-3">
        <p className="text-xs">
          Manual adjustments update the internal wallet only. Payment gateway refunds require separate processing.
        </p>
      </Alert>

      <div className="space-y-3 mb-4">
        <Input
          label="Amount (SAR)"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 50.00"
        />
        <Input
          label="Trip ID (optional link)"
          value={tripId}
          onChange={(e) => setTripId(e.target.value)}
          placeholder="Link adjustment to a trip"
        />
        <Textarea
          label="Reason (required, min 10 chars)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Explain why this adjustment is being made…"
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" loading={submitting} onClick={() => submitAdjustment(1)}>
            Credit wallet
          </Button>
          <Button variant="danger-outline" size="sm" loading={submitting} onClick={() => submitAdjustment(-1)}>
            Debit wallet
          </Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Recent transactions</p>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-gray-500">No wallet transactions.</p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {transactions.map((tx) => {
            const adminActor = formatWalletTransactionAdmin(tx);
            return (
            <li key={tx.id} className="text-xs border border-gray-100 rounded-lg p-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{tx.txType} · SAR {Number(tx.amountSar).toFixed(2)}</span>
                <span className="text-gray-400">{new Date(tx.createdAt).toLocaleString()}</span>
              </div>
              {tx.source && (
                <StatusBadge variant="info" className="mt-1 text-[10px]">
                  {SOURCE_LABELS[tx.source] ?? tx.source}
                </StatusBadge>
              )}
              <p className="text-gray-600 mt-1">{tx.reason ?? tx.description ?? '—'}</p>
              {adminActor && (
                <p className="text-gray-500 mt-0.5">
                  Processed by: <span className="font-medium">{adminActor}</span>
                </p>
              )}
              {tx.tripId && <p className="text-gray-400 font-mono mt-0.5">Trip: {tx.tripId.slice(0, 8)}…</p>}
            </li>
            );
          })}
        </ul>
      )}
    </AdminDrawerSection>
  );
}
