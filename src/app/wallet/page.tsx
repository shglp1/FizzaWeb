'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { walletService } from '@/services/walletService';
import { paymentService } from '@/services/paymentService';

const QUICK_AMOUNTS = [50, 100, 200, 500] as const;
const MIN_TOP_UP = 10;
const MAX_TOP_UP = 10_000;

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
  DEBIT:                { label: 'Debit',                sign: '−', color: 'text-red-600' },
  REFUND:               { label: 'Refund',               sign: '+', color: 'text-blue-600' },
  TOP_UP:               { label: 'Top-up',               sign: '+', color: 'text-emerald-600' },
  SUBSCRIPTION_PAYMENT: { label: 'Subscription payment', sign: '−', color: 'text-red-600' },
};

export default function WalletPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [customAmount, setCustomAmount] = useState('');
  const [topUpError, setTopUpError] = useState('');
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
      <h1 className="text-2xl font-semibold mb-6">My Wallet</h1>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Loading wallet…</div>
      ) : pageError ? (
        <div className="card text-red-600 text-sm">{pageError}</div>
      ) : (
        <div className="space-y-6">
          {/* Balance card */}
          <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <p className="text-sm text-emerald-700 font-medium mb-1">Available Balance</p>
            <p className="text-4xl font-bold text-emerald-800">
              {balance.toLocaleString('en-SA', { style: 'currency', currency: 'SAR', minimumFractionDigits: 2 })}
            </p>
            {wallet && (
              <p className="text-xs text-emerald-600 mt-1">
                Last updated {new Date(wallet.updatedAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Loyalty points card */}
          <div className="card bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <p className="text-sm text-amber-700 font-medium mb-1">Loyalty Points</p>
            <p className="text-3xl font-bold text-amber-800">{loyaltyPoints.toLocaleString()} pts</p>
            <p className="text-xs text-amber-600 mt-1">Earned by completing subscriptions and approved safety reports.</p>
          </div>

          {/* Top-up section */}
          <div className="card">
            <h2 className="font-semibold mb-4">Top Up Wallet</h2>

            {topUpError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{topUpError}</p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => handleTopUp(amt)}
                  disabled={topUpLoading}
                  className="py-2.5 rounded-xl border border-emerald-300 text-emerald-700 font-semibold text-sm hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                >
                  SAR {amt}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="number"
                min={MIN_TOP_UP}
                max={MAX_TOP_UP}
                step="1"
                placeholder={`Custom amount (min SAR ${MIN_TOP_UP})`}
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setTopUpError(''); }}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                onClick={handleCustomTopUp}
                disabled={topUpLoading || !customAmount}
                className="btn-primary text-sm px-4 py-2 rounded-xl disabled:opacity-50"
              >
                {topUpLoading ? 'Redirecting…' : 'Top Up'}
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-2">
              You will be redirected to our secure payment provider (MyFatoorah) to complete the top-up.
            </p>
          </div>

          {/* Recent transactions */}
          <div className="card">
            <h2 className="font-semibold mb-4">Recent Transactions</h2>
            {!wallet?.transactions.length ? (
              <p className="text-sm text-gray-400 text-center py-6">No transactions yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {wallet.transactions.map((tx) => {
                  const cfg = TX_CFG[tx.txType] ?? { label: tx.txType, sign: '', color: 'text-gray-700' };
                  return (
                    <div key={tx.id} className="flex items-center justify-between py-3 gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{cfg.label}</p>
                        {tx.description && (
                          <p className="text-xs text-gray-400">{tx.description}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold whitespace-nowrap ${cfg.color}`}>
                        {cfg.sign} SAR {Number(tx.amountSar).toLocaleString('en-SA', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
