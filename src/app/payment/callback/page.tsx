'use client';

import { Clock, TriangleAlert } from 'lucide-react';

/**
 * /payment/callback
 *
 * Browser landing page after returning from the MyFatoorah payment page.
 * MyFatoorah appends ?paymentId=...&Id=... to the CallBackUrl.
 *
 * This page:
 *   1. Shows a loading state while it calls GET /api/payments/callback
 *   2. Shows a success card on PAID / ALREADY_PROCESSED
 *   3. Shows a "still processing" card on PENDING (with a Retry button)
 *   4. Shows a failure card on FAILED
 *
 * Local development: works on localhost because the browser returns here.
 * Webhook (POST) requires a public URL (ngrok etc.) — see README.
 *
 * NOTE: useSearchParams() must be inside a <Suspense> boundary to allow
 * Next.js static prerendering. PaymentCallbackContent is the real component;
 * PaymentCallbackPage is the thin wrapper that provides the boundary.
 */

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type VerifyResult = {
  outcome: 'PAID' | 'FAILED' | 'PENDING' | 'ALREADY_PROCESSED';
  status: string;
  purpose?: string;
  subscriptionId?: string | null;
  walletUpdated?: boolean;
  subscriptionActivated?: boolean;
};

// ─── Minimal spinner ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-8 w-8 text-fizza-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ─── Suspense fallback shown while Next.js resolves the search params ─────────

function PaymentCallbackLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="flex justify-center">
            <Spinner />
          </div>
          <h1 className="text-lg font-semibold text-gray-800">Preparing payment verification…</h1>
          <p className="text-sm text-gray-500">Please wait a moment.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Inner component — safe to call useSearchParams() here ───────────────────

function PaymentCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [verifying, setVerifying] = useState(true);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = useCallback(async () => {
    setVerifying(true);
    setError(null);

    // Build the API URL preserving all query params MyFatoorah appended
    const params = new URLSearchParams();
    const id = searchParams.get('Id');
    const paymentId = searchParams.get('paymentId');
    if (id) params.set('Id', id);
    if (paymentId) params.set('paymentId', paymentId);

    if (!id && !paymentId) {
      setError('No payment reference found in the URL. Please contact support.');
      setVerifying(false);
      return;
    }

    try {
      const res = await fetch(`/api/payments/callback?${params.toString()}`);
      const json = await res.json();

      if (json.data) {
        setResult(json.data as VerifyResult);
      } else {
        setError(json.error?.message ?? 'Unable to verify your payment. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setVerifying(false);
    }
  }, [searchParams]);

  useEffect(() => {
    verify();
  }, [verify]);

  const isPaid =
    result?.outcome === 'PAID' || result?.outcome === 'ALREADY_PROCESSED';
  const isWallet = result?.purpose === 'WALLET_TOP_UP';
  const isSubscription = result?.purpose === 'SUBSCRIPTION_PAYMENT';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {verifying && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="flex justify-center">
              <Spinner />
            </div>
            <h1 className="text-lg font-semibold text-gray-800">Verifying your payment…</h1>
            <p className="text-sm text-gray-500">Please wait while we confirm your transaction.</p>
          </div>
        )}

        {/* ── Error from API ───────────────────────────────────────────────── */}
        {!verifying && error && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <TriangleAlert className="h-12 w-12 text-amber-500 mx-auto" strokeWidth={1.75} aria-hidden />
            <h1 className="text-lg font-semibold text-gray-800">Something went wrong</h1>
            <p className="text-sm text-gray-500">{error}</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={verify}
                className="w-full rounded-xl bg-fizza-primary py-2.5 text-sm font-semibold text-white hover:bg-fizza-primary/90 transition-colors"
              >
                Try Again
              </button>
              <Link
                href="/subscriptions"
                className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
              >
                Go to Subscriptions
              </Link>
            </div>
          </div>
        )}

        {/* ── Success (PAID / ALREADY_PROCESSED) ──────────────────────────── */}
        {!verifying && !error && isPaid && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg
                  className="h-8 w-8 text-emerald-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-lg font-semibold text-gray-800">Payment Successful!</h1>
            <p className="text-sm text-gray-500">
              {result?.outcome === 'ALREADY_PROCESSED'
                ? 'This payment was already confirmed.'
                : isSubscription
                ? 'Your subscription is now active.'
                : isWallet
                ? 'Your wallet has been topped up.'
                : 'Your payment has been confirmed.'}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              {isSubscription && (
                <Link
                  href="/subscriptions"
                  className="w-full rounded-xl bg-fizza-primary py-2.5 text-sm font-semibold text-white hover:bg-fizza-primary/90 transition-colors text-center"
                >
                  View My Subscriptions
                </Link>
              )}
              {isWallet && (
                <Link
                  href="/wallet"
                  className="w-full rounded-xl bg-fizza-primary py-2.5 text-sm font-semibold text-white hover:bg-fizza-primary/90 transition-colors text-center"
                >
                  View My Wallet
                </Link>
              )}
              {!isSubscription && !isWallet && (
                <button
                  onClick={() => router.push('/wallet')}
                  className="w-full rounded-xl bg-fizza-primary py-2.5 text-sm font-semibold text-white hover:bg-fizza-primary/90 transition-colors"
                >
                  Go to Wallet
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Pending ──────────────────────────────────────────────────────── */}
        {!verifying && !error && result?.outcome === 'PENDING' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <Clock className="h-12 w-12 text-blue-500 mx-auto" strokeWidth={1.75} aria-hidden />
            <h1 className="text-lg font-semibold text-gray-800">Payment is being processed</h1>
            <p className="text-sm text-gray-500">
              Your payment is still being confirmed by the bank. This usually takes a few seconds.
              You can retry verification or check back in a moment.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={verify}
                className="w-full rounded-xl bg-fizza-primary py-2.5 text-sm font-semibold text-white hover:bg-fizza-primary/90 transition-colors"
              >
                Retry Verification
              </button>
              <Link
                href="/subscriptions"
                className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
              >
                Go to Subscriptions
              </Link>
            </div>
          </div>
        )}

        {/* ── Failed ───────────────────────────────────────────────────────── */}
        {!verifying && !error && result?.outcome === 'FAILED' && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-lg font-semibold text-gray-800">Payment Failed</h1>
            <p className="text-sm text-gray-500">
              Your payment could not be processed. No charge was made. Please try again.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/subscriptions"
                className="w-full rounded-xl bg-fizza-primary py-2.5 text-sm font-semibold text-white hover:bg-fizza-primary/90 transition-colors text-center"
              >
                Back to Subscriptions
              </Link>
              <Link
                href="/wallet"
                className="w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
              >
                Back to Wallet
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page export — wraps content in Suspense for static prerender ─────────────

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<PaymentCallbackLoading />}>
      <PaymentCallbackContent />
    </Suspense>
  );
}
