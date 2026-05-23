'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  PageHeader,
  StatCard,
  Card,
  Alert,
  Button,
  Input,
  EmptyState,
  LoadingState,
  ErrorState,
} from '@/components/ui';
import { walletService } from '@/services/walletService';
import { paymentService } from '@/services/paymentService';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_AMOUNTS = [50, 100, 200, 500] as const;
const MIN_TOP_UP = 10;
const MAX_TOP_UP = 10_000;

// ─── Types ────────────────────────────────────────────────────────────────────

type TxType = 'CREDIT' | 'DEBIT' | 'REFUND' | 'TOP_UP' | 'SUBSCRIPTION_PAYMENT';

type Transaction = {
  id: string;
  amountSar: string;
  txType: TxType;
  description: string | null;
  createdAt: string;
};

type Wallet = {
  id: string;
  balanceSar: string;
  updatedAt: string;
  transactions: Transaction[];
};

const TX_CFG: Record<TxType, { label: string; sign: string; color: string; dot: string }> = {
  CREDIT:               { label: 'Credit',               sign: '+', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  DEBIT:                { label: 'Debit',                sign: '−', color: 'text-red-600',     dot: 'bg-red-500'     },
  REFUND:               { label: 'Refund',               sign: '+', color: 'text-blue-600',    dot: 'bg-blue-500'    },
  TOP_UP:               { label: 'Top-up',               sign: '+', color: 'text-emerald-600', dot: 'bg-emerald-500' },
  SUBSCRIPTION_PAYMENT: { label: 'Subscription payment', sign: '−', color: 'text-red-600',     dot: 'bg-red-500'     },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const [wallet, setWallet]             = useState<Wallet | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [loading, setLoading]           = useState(true);
  const [pageError, setPageError]       = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [topUpError, setTopUpError]     = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);

  const loadWallet = () => {
    setLoading(true);
    walletService.getWallet().then((res: { data?: { wallet: Wallet; loyaltyPoints?: number }; error?: { message: string } }) => {
      if (res.data) {
        setWallet(res.data.wallet);
        setLoyaltyPoints(res.data.loyaltyPoints ?? 0);
      } else {
        setPageError(res.error?.message ?? 'Failed to load wallet.');
      }
      setLoading(false);
    });
  };

  useEffect(() => { loadWallet(); }, []);

  const handleTopUp = async (amount: number) => {
    setTopUpError('');
    setTopUpLoading(true);
    const res = await paymentService.createPayment({ purpose: 'WALLET_TOP_UP', amountSar: amount });
    setTopUpLoading(false);
    if (res.data?.invoiceUrl) {
      window.location.href = res.data.invoiceUrl;
    } else {
      setTopUpError(res.error?.message ?? 'Failed to initiate top-up. Please try again.');
    }
  };

  const handleCustomTopUp = () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount < MIN_TOP_UP) {
      setTopUpError(`Minimum top-up is SAR ${MIN_TOP_UP}.`);
      return;
    }
    if (amount > MAX_TOP_UP) {
      setTopUpError(`Maximum top-up is SAR ${MAX_TOP_UP.toLocaleString()}.`);
      return;
    }
    handleTopUp(amount);
  };

  const balance = wallet ? Number(wallet.balanceSar) : 0;

  return (
    <AppShell>
      <PageHeader
        title="My Wallet"
        subtitle="Manage your balance, top up funds, and view transaction history"
      />

      {loading ? (
        <LoadingState message="Loading your wallet…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={loadWallet} />
      ) : (
        <div className="space-y-6">
          {/* Balance hero card */}
          <div className="rounded-2xl bg-gradient-to-br from-fizza-primary to-fizza-secondary p-6 text-white shadow-card-md relative overflow-hidden">
            <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/5" />
            <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/5" />
            <div className="relative">
              <p className="text-sm font-medium text-white/70 mb-2">Available Balance</p>
              <p className="text-5xl font-bold tracking-tight">
                {balance.toLocaleString('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 })}
              </p>
              {wallet && (
                <p className="text-xs text-white/50 mt-3">
                  Last updated {new Date(wallet.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid sm:grid-cols-2 gap-4">
            <StatCard
              label="Loyalty Points"
              value={`${loyaltyPoints.toLocaleString()} pts`}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              }
              color="#F59E0B"
            />
            <StatCard
              label="Total Transactions"
              value={wallet?.transactions.length ?? 0}
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
              color="#6366F1"
            />
          </div>

          {/* Top-up */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-1">Top Up Wallet</h2>
            <p className="text-sm text-gray-500 mb-4">
              You will be redirected to MyFatoorah (secure payment) to complete the top-up.
            </p>

            {topUpError && (
              <Alert variant="error" className="mb-4" onClose={() => setTopUpError('')}>
                {topUpError}
              </Alert>
            )}

            {/* Quick amounts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {QUICK_AMOUNTS.map((amt) => (
                <Button
                  key={amt}
                  variant="outline"
                  disabled={topUpLoading}
                  onClick={() => handleTopUp(amt)}
                >
                  SAR {amt}
                </Button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="Custom amount"
                  type="number"
                  min={MIN_TOP_UP}
                  max={MAX_TOP_UP}
                  step="1"
                  placeholder={`Min SAR ${MIN_TOP_UP}`}
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setTopUpError(''); }}
                />
              </div>
              <Button
                variant="primary"
                onClick={handleCustomTopUp}
                disabled={topUpLoading || !customAmount}
                loading={topUpLoading}
                className="mb-[1px]"
              >
                Top Up
              </Button>
            </div>
          </Card>

          {/* Transaction history */}
          <Card>
            <h2 className="text-base font-semibold text-gray-900 mb-4">Transaction History</h2>

            {!wallet?.transactions.length ? (
              <EmptyState
                icon="💳"
                title="No transactions yet"
                description="Your history will appear here after your first top-up or payment."
              />
            ) : (
              <div className="divide-y divide-gray-50">
                {wallet.transactions.map((tx) => {
                  const cfg = TX_CFG[tx.txType] ?? { label: tx.txType, sign: '', color: 'text-gray-700', dot: 'bg-gray-400' };
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-3.5 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${cfg.dot}`} aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">{cfg.label}</p>
                          {tx.description && (
                            <p className="text-xs text-gray-400 truncate">{tx.description}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(tx.createdAt).toLocaleString('en-SA', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold whitespace-nowrap ${cfg.color}`}>
                        {cfg.sign} SAR {Number(tx.amountSar).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
