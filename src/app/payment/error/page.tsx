'use client';

/**
 * /payment/error
 *
 * Browser landing page when the user cancels on the MyFatoorah payment page
 * or an unrecoverable error occurs.
 *
 * MyFatoorah redirects here via ErrorUrl. No API call is made — this page is
 * purely informational. The user can navigate back to try again.
 */

import Link from 'next/link';

export default function PaymentErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
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
            </div>
          </div>

          <h1 className="text-lg font-semibold text-gray-800">Payment Cancelled</h1>
          <p className="text-sm text-gray-500">
            Your payment was cancelled or could not be completed. No charge has been made.
            You can try again whenever you&apos;re ready.
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
      </div>
    </div>
  );
}
