'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Alert, Textarea, StatusBadge, ConfirmDialog } from '@/components/ui';
import { FINANCIAL_REVIEW_ACTIONS, type FinancialReviewAction } from '@/lib/trips/financialReview';

const ACTION_LABELS: Record<FinancialReviewAction, string> = {
  PAY_DRIVER: 'Pay driver — include in payroll',
  NO_PAY_DRIVER: 'Do not pay driver',
  REFUND_PARENT: 'Refund parent (gateway/manual — audit record)',
  CREDIT_PARENT: 'Credit parent wallet (automated)',
  KEEP_REVENUE: 'Keep revenue — pay driver if trip valid',
  INCIDENT: 'Incident — do not pay driver',
};

const PAYOUT_IMPACT: Record<FinancialReviewAction, string> = {
  PAY_DRIVER: 'Driver WILL be included in payroll for this trip.',
  NO_PAY_DRIVER: 'Driver will NOT be paid for this trip.',
  REFUND_PARENT: 'Records that the parent should receive a payment gateway refund. Does NOT process MyFatoorah/card refund automatically. Driver will NOT be paid.',
  CREDIT_PARENT: 'Will credit the parent internal wallet automatically. Amount is computed from subscription context. Driver will NOT be paid.',
  KEEP_REVENUE: 'Fizza keeps trip revenue. Driver WILL be paid (trip performed correctly).',
  INCIDENT: 'Operational incident logged. Driver will NOT be paid unless you later choose Pay driver.',
};

type CreditPreview = {
  parentId: string;
  parentName: string;
  amountSar: number;
  amountExplanation: string;
  alreadyCredited: boolean;
  existingTransactionId: string | null;
};

type Props = {
  tripId: string;
  status: string;
  financialReviewStatus?: string | null;
  financialReviewReason?: string | null;
  financialReviewedAt?: string | null;
  walletCreditTransactionId?: string | null;
  onResolved?: () => void;
};

export function TripFinancialReviewPanel({
  tripId,
  status,
  financialReviewStatus,
  financialReviewReason,
  financialReviewedAt,
  walletCreditTransactionId,
  onResolved,
}: Props) {
  const [action, setAction] = useState<FinancialReviewAction>('PAY_DRIVER');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creditPreview, setCreditPreview] = useState<CreditPreview | null>(null);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [walletTxRef, setWalletTxRef] = useState<string | null>(walletCreditTransactionId ?? null);

  const payoutNote = useMemo(() => PAYOUT_IMPACT[action], [action]);
  const walletCreditProcessed = Boolean(walletTxRef);

  useEffect(() => {
    if (action !== 'CREDIT_PARENT' || status !== 'COMPLETED') {
      setCreditPreview(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/trips/${tripId}/financial-review/credit-preview`)
      .then((r) => r.json())
      .then((res) => {
        if (!cancelled && res.data?.preview) setCreditPreview(res.data.preview as CreditPreview);
      })
      .catch(() => { if (!cancelled) setCreditPreview(null); });
    return () => { cancelled = true; };
  }, [action, tripId, status]);

  if (status !== 'COMPLETED') {
    return (
      <p className="text-sm text-gray-500">
        Financial review applies after the trip is marked completed.
      </p>
    );
  }

  const showForm = !financialReviewStatus || financialReviewStatus === 'PENDING';

  async function submitReview(confirmAmountSar?: number) {
    setError('');
    setSuccess('');
    if (reason.trim().length < 3) {
      setError('Please enter a reason (at least 3 characters).');
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = { action, reason: reason.trim() };
      if (action === 'CREDIT_PARENT' && confirmAmountSar != null) {
        body.confirmAmountSar = confirmAmountSar;
      }
      const res = await fetch(`/api/admin/trips/${tripId}/financial-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.data) {
        if (json.data.walletCredit?.transactionId) {
          setWalletTxRef(json.data.walletCredit.transactionId);
          setSuccess(
            json.data.walletCredit.duplicate
              ? 'Wallet credit already processed (idempotent).'
              : `Wallet credited SAR ${Number(json.data.walletCredit.amountSar).toFixed(2)}. Ref: ${json.data.walletCredit.transactionId}`,
          );
        } else if (action === 'REFUND_PARENT') {
          setSuccess('Refund decision recorded. Process payment gateway refund manually.');
        } else {
          setSuccess('Financial review recorded.');
        }
        setShowCreditConfirm(false);
        onResolved?.();
      } else {
        setError(json.error?.message ?? 'Failed to save review.');
      }
    } catch {
      setError('Unable to save financial review.');
    } finally {
      setLoading(false);
    }
  }

  function handleSaveClick() {
    if (action === 'CREDIT_PARENT') {
      if (!creditPreview) {
        setError('Unable to load credit preview. Check trip subscription data.');
        return;
      }
      if (creditPreview.alreadyCredited) {
        setError('Wallet credit already processed for this trip.');
        return;
      }
      setShowCreditConfirm(true);
      return;
    }
    submitReview();
  }

  return (
    <div className="space-y-3">
      {financialReviewStatus && (
        <div className="text-sm space-y-2">
          <p className="font-medium text-gray-800">
            Status: {financialReviewStatus.replace(/_/g, ' ')}
          </p>
          {financialReviewStatus === 'CREDIT_PARENT' && walletCreditProcessed && (
            <StatusBadge variant="success">Wallet credit processed</StatusBadge>
          )}
          {financialReviewStatus === 'CREDIT_PARENT' && !walletCreditProcessed && (
            <StatusBadge variant="warning">Wallet credit pending</StatusBadge>
          )}
          {financialReviewStatus === 'REFUND_PARENT' && (
            <StatusBadge variant="warning">Payment gateway refund — manual action required</StatusBadge>
          )}
          {financialReviewReason && (
            <p className="text-gray-600 mt-1">{financialReviewReason}</p>
          )}
          {financialReviewedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Reviewed {new Date(financialReviewedAt).toLocaleString()}
            </p>
          )}
          {walletTxRef && (
            <p className="text-xs font-mono text-emerald-800 bg-emerald-50 rounded px-2 py-1">
              Wallet transaction: {walletTxRef}
            </p>
          )}
          {financialReviewStatus === 'REFUND_PARENT' && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              This records the refund decision only. Process MyFatoorah/card refund via your payment operations workflow.
            </p>
          )}
        </div>
      )}

      {showForm ? (
        <>
          <label className="block text-sm font-medium text-gray-700">
            Resolution
            <select
              className="input mt-1 w-full"
              value={action}
              onChange={(e) => setAction(e.target.value as FinancialReviewAction)}
            >
              {FINANCIAL_REVIEW_ACTIONS.map((a) => (
                <option key={a} value={a}>{ACTION_LABELS[a]}</option>
              ))}
            </select>
          </label>

          <Alert variant={action === 'CREDIT_PARENT' || action === 'REFUND_PARENT' ? 'warning' : 'info'}>
            <p className="text-sm font-medium">{payoutNote}</p>
            {action === 'CREDIT_PARENT' && creditPreview && (
              <p className="text-xs mt-2">
                Parent: {creditPreview.parentName} · Amount: SAR {creditPreview.amountSar.toFixed(2)}
                <br />{creditPreview.amountExplanation}
              </p>
            )}
          </Alert>

          <Textarea
            label="Reason (required for audit)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain the payroll / revenue decision for audit…"
            rows={3}
          />
          {error && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          <Button variant="primary" size="sm" loading={loading} onClick={handleSaveClick}>
            {action === 'CREDIT_PARENT' ? 'Review & confirm wallet credit' : 'Save financial review'}
          </Button>
        </>
      ) : (
        <p className="text-xs text-gray-500">
          This trip has a resolved financial review. Contact engineering if a correction is needed — changes are audit-logged.
        </p>
      )}

      <ConfirmDialog
        isOpen={showCreditConfirm}
        title="Confirm wallet credit"
        message={
          creditPreview
            ? `Credit SAR ${creditPreview.amountSar.toFixed(2)} to ${creditPreview.parentName}? This updates the parent wallet immediately and cannot be duplicated for this trip.`
            : 'Confirm wallet credit?'
        }
        confirmLabel="Credit wallet"
        confirmVariant="primary"
        onConfirm={() => creditPreview && submitReview(creditPreview.amountSar)}
        onCancel={() => setShowCreditConfirm(false)}
      />
    </div>
  );
}
