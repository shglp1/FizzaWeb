'use client';

import { useEffect, useRef, useState } from 'react';
import { Receipt } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  ParentPageHeader,
  ParentWalletHero,
  ParentWalletTxRow,
  ParentDrawer,
  ParentSectionCard,
  ParentEmptyState,
  ParentLoadingState,
  ParentErrorState,
} from '@/components/parent/ParentUI';
import { Alert, Button, Input, Badge } from '@/components/ui';
import { walletService } from '@/services/walletService';
import { paymentService } from '@/services/paymentService';
import { formatSarParent, groupTransactionsByDate } from '@/lib/parent/parentFormatters';

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

const TX_CFG: Record<TxType, { label: string; sign: string; color: string }> = {
  CREDIT:               { label: 'Credit',               sign: '+', color: 'text-emerald-600' },
  DEBIT:                { label: 'Debit',                sign: '-', color: 'text-red-600'     },
  REFUND:               { label: 'Refund',               sign: '+', color: 'text-blue-600'    },
  TOP_UP:               { label: 'Top-up',               sign: '+', color: 'text-emerald-600' },
  SUBSCRIPTION_PAYMENT: { label: 'Subscription payment', sign: '-', color: 'text-red-600'     },
};

function formatTxAmountSimple(tx: Transaction): string {
  const cfg = TX_CFG[tx.txType] ?? { sign: '', color: 'text-gray-700' };
  const n = Number(tx.amountSar);
  return `${cfg.sign}${formatSarParent(n)}`;
}

function formatTxTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-SA', { hour: '2-digit', minute: '2-digit' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [topUpError, setTopUpError] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const topUpRef = useRef<HTMLDivElement>(null);

  const loadWallet = () => {
    setLoading(true);
    walletService.getWallet().then((res: { data?: { wallet: Wallet }; error?: { message: string } }) => {
      if (res.data) setWallet(res.data.wallet);
      else setPageError(res.error?.message ?? 'Failed to load wallet.');
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

  const scrollToTopUp = () => {
    topUpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const balance = wallet ? Number(wallet.balanceSar) : 0;
  const grouped = wallet?.transactions.length
    ? groupTransactionsByDate(wallet.transactions)
    : [];

  return (
    <AppShell>
      <ParentPageHeader
        title="My Wallet"
        subtitle="Manage your balance, top up funds, and view transaction history"
      />

      {loading ? (
        <ParentLoadingState message="Loading your wallet…" />
      ) : pageError ? (
        <ParentErrorState message={pageError} onRetry={loadWallet} />
      ) : (
        <div className="space-y-6">
          <ParentWalletHero
            balance={formatSarParent(balance)}
            lastUpdated={wallet ? new Date(wallet.updatedAt).toLocaleDateString('en-SA') : undefined}
            onTopUp={scrollToTopUp}
            topUpLoading={topUpLoading}
          />

          <div ref={topUpRef} id="top-up">
            <ParentSectionCard title="Top up wallet">
              <div className="p-4 sm:p-5 space-y-4">
                <p className="text-sm text-gray-500">
                  You will be redirected to MyFatoorah (secure payment) to complete the top-up.
                </p>

                {topUpError && (
                  <Alert variant="error" onClose={() => setTopUpError('')}>
                    {topUpError}
                  </Alert>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {QUICK_AMOUNTS.map((amt) => (
                    <Button
                      key={amt}
                      variant="outline"
                      disabled={topUpLoading}
                      onClick={() => handleTopUp(amt)}
                      className="min-h-[44px]"
                    >
                      SAR {amt}
                    </Button>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
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
                    className="min-h-[44px] sm:mb-[1px]"
                  >
                    Top Up
                  </Button>
                </div>
              </div>
            </ParentSectionCard>
          </div>

          <ParentSectionCard title="Transaction history">
            {!wallet?.transactions.length ? (
              <div className="p-6">
                <ParentEmptyState
                  icon={Receipt}
                  title="No transactions yet"
                  description="Your history will appear here after your first top-up or payment."
                />
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {grouped.map(({ date, items }) => (
                  <div key={date}>
                    <p className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400 bg-gray-50/80">
                      {date}
                    </p>
                    <div className="divide-y divide-gray-50">
                      {items.map((tx) => {
                        const cfg = TX_CFG[tx.txType] ?? { label: tx.txType, sign: '', color: 'text-gray-700' };
                        return (
                          <ParentWalletTxRow
                            key={tx.id}
                            label={tx.description ?? cfg.label}
                            amount={formatTxAmountSimple(tx)}
                            amountColor={cfg.color}
                            time={formatTxTime(tx.createdAt)}
                            onClick={() => setSelectedTx(tx)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ParentSectionCard>
        </div>
      )}

      <ParentDrawer
        open={!!selectedTx}
        onClose={() => setSelectedTx(null)}
        title="Transaction details"
      >
        {selectedTx && (() => {
          const cfg = TX_CFG[selectedTx.txType] ?? { label: selectedTx.txType, sign: '', color: 'text-gray-700' };
          return (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Type</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{cfg.label}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Amount</p>
                <p className={`text-xl font-bold tabular-nums mt-0.5 ${cfg.color}`}>
                  {formatTxAmountSimple(selectedTx)}
                </p>
              </div>
              {selectedTx.description && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Description</p>
                  <p className="text-sm text-gray-800 mt-0.5">{selectedTx.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Date and time</p>
                <p className="text-sm text-gray-800 mt-0.5">
                  {new Date(selectedTx.createdAt).toLocaleString('en-SA', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Reference</p>
                <p className="text-xs font-mono text-gray-600 mt-0.5 break-all">{selectedTx.id}</p>
              </div>
              <Badge variant="gray" className="text-[10px]">{selectedTx.txType}</Badge>
            </div>
          );
        })()}
      </ParentDrawer>
    </AppShell>
  );
}
