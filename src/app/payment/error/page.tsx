'use client';

/**
 * /payment/error
 *
 * Browser landing page when the user cancels on the MyFatoorah payment page
 * or an unrecoverable payment error occurs.
 *
 * MyFatoorah redirects here via ErrorUrl. The page reads optional query
 * params to provide context:
 *   ?reason=cancelled  — user pressed Cancel/Back on the payment page
 *   ?reason=failed     — payment was attempted but declined / expired
 *   ?invoiceUrl=...    — stored payment URL, allows "Resume Payment" redirect
 *
 * No sensitive data is passed in the URL — invoiceUrl is an opaque
 * MyFatoorah-hosted page, not a raw API token.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ─── Inner content (must be inside Suspense) ──────────────────────────────────

function PaymentErrorContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? 'cancelled';
  const invoiceUrl = searchParams.get('invoiceUrl');

  const isFailed = reason === 'failed';

  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className={[
              'flex h-16 w-16 items-center justify-center rounded-full',
              isFailed ? 'bg-red-100' : 'bg-amber-100',
            ].join(' ')}
          >
            {isFailed ? (
              /* X icon for failed */
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
            ) : (
              /* Warning icon for cancelled */
              <svg
                className="h-8 w-8 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            )}
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-lg font-semibold text-gray-800">
          {isFailed ? 'Payment Failed' : 'Payment Cancelled'}
        </h1>

        {/* Body */}
        <p className="text-sm text-gray-500">
          {isFailed
            ? 'Your payment could not be processed. This may be due to insufficient funds, an expired card, or a temporary gateway issue. No charge has been made.'
            : "You cancelled the payment. No charge has been made. You can try again whenever you’re ready."}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          {/* Resume Payment — only shown when we have the invoice URL */}
          {invoiceUrl && (
            <a
              href={invoiceUrl}
              className="w-full rounded-xl bg-fizza-primary py-2.5 text-sm font-semibold text-white hover:bg-fizza-primary/90 transition-colors text-center"
            >
              Resume Payment
            </a>
          )}

          <Link
            href="/subscriptions"
            className={[
              'w-full rounded-xl py-2.5 text-sm font-semibold text-center transition-colors',
              invoiceUrl
                ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                : 'bg-fizza-primary text-white hover:bg-fizza-primary/90',
            ].join(' ')}
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

        <p className="text-xs text-gray-400 pt-1">
          Need help?{' '}
          <a href="mailto:support@fizza.com" className="text-fizza-primary hover:underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Loading fallback ─────────────────────────────────────────────────────────

function PaymentErrorLoading() {
  return (
    <div className="w-full max-w-sm">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4 animate-pulse">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-gray-200" />
        </div>
        <div className="h-5 bg-gray-200 rounded mx-auto w-48" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={<PaymentErrorLoading />}>
        <PaymentErrorContent />
      </Suspense>
    </div>
  );
}
