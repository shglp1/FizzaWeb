# MyFatoorah Integration — Testing Guide

This document explains how to test the MyFatoorah payment integration, what credentials are needed, how the integration works, and what to avoid.

---

## Integration Method

This app uses the **Hosted Payment Page / Invoice URL** flow.

The user is redirected to a hosted payment page on MyFatoorah's domain. No card data ever touches our servers. This is the correct choice because:

- **Direct Payment** (collecting card details in our form) requires PCI DSS certification and is explicitly documented as requiring a PCI certificate. We do not implement Direct Payment.
- The invoice/hosted URL flow is the safe, standard approach for web apps without PCI certification.

### Flow

1. Our server calls `POST /v2/SendPayment` with the amount, currency, customer details, and callback URLs.
2. MyFatoorah returns an `InvoiceURL` — a hosted payment page on their domain.
3. We redirect the user to `InvoiceURL`.
4. The user completes payment on MyFatoorah's hosted page.
5. MyFatoorah calls our webhook (`/api/payments/webhook`) with the payment result.
6. Our webhook calls `POST /v2/GetPaymentStatus` to verify server-side before updating the database.
7. We never mark a payment as PAID based on the browser redirect alone.

---

## Environment Variables

Set these in your `.env` file (never commit real credentials):

```env
# MyFatoorah API key — obtain from your MyFatoorah portal
MYFATOORAH_API_KEY=

# Base URL
# Demo (sandbox):     https://apitest.myfatoorah.com
# Live (Saudi Arabia): https://api.myfatoorah.com
MYFATOORAH_BASE_URL=

# Webhook secret — set in your MyFatoorah portal webhook configuration
# Used to verify the HMAC-SHA256 signature on incoming webhook calls
MYFATOORAH_WEBHOOK_SECRET=

# Your app's public URL — used for callback and error URLs sent to MyFatoorah
APP_URL=https://yourapp.com
```

---

## Getting Demo Credentials

1. Go to the MyFatoorah website and register for a **Demo/Sandbox** account.
2. Log in to the MyFatoorah Demo Portal.
3. Navigate to **API Settings** or **Integration** to obtain your demo API key.
4. The demo API key is different from the live API key — use the demo key only with `MYFATOORAH_BASE_URL=https://apitest.myfatoorah.com`.
5. Refer to the [MyFatoorah Documentation](https://docs.myfatoorah.com/docs/overview) for the latest demo portal URL and registration steps.

---

## Test Cards

MyFatoorah provides test card numbers for use in the demo environment only. Find the current test cards in the official docs:

- [MyFatoorah Test Cards](https://docs.myfatoorah.com/docs/test-cards)

Common test scenarios (verify in docs for current values):
- **Successful payment**: Use the test card number marked as "success"
- **Failed payment**: Use the test card number marked as "failed" or "declined"
- **3DS authentication**: Some test cards trigger the 3DS flow

> **Note**: Test cards work only in the demo environment (`https://apitest.myfatoorah.com`). They will not work in production.

---

## Creating a Wallet Top-Up (Test)

1. Ensure your `.env` has demo credentials.
2. Log in to your app.
3. Navigate to `/wallet`.
4. Click any quick top-up amount (SAR 50, 100, 200, 500) or enter a custom amount.
5. You will be redirected to the MyFatoorah hosted payment page.
6. Complete payment using a test card from the docs.
7. MyFatoorah will call your webhook (`/api/payments/webhook`).
8. Your webhook verifies the payment server-side via `GetPaymentStatus`.
9. If verified as PAID, wallet balance is credited.
10. A notification appears under `/notifications`.

> **Local testing**: For webhook to reach your local server, you need a tunnel like `ngrok`. Set `APP_URL=https://your-ngrok-url.ngrok.io` and configure it in MyFatoorah's portal as the callback URL.

---

## Creating a Subscription Payment (Test)

1. Create a subscription via `/subscriptions/new`.
2. The subscription starts in `PENDING` payment status.
3. On `/subscriptions`, click **Pay Online**.
4. You will be redirected to the MyFatoorah hosted payment page.
5. Complete with a test card.
6. Webhook is called → `GetPaymentStatus` verifies → subscription becomes ACTIVE.

---

## Webhook Configuration

In your MyFatoorah portal:

1. Navigate to **Integration** → **Webhook** settings.
2. Set the **Callback URL** to: `https://yourapp.com/api/payments/webhook`
3. Set the **Error URL** (redirect on failure) — we set this to `/wallet` by default.
4. Copy the **Webhook Secret** and set it as `MYFATOORAH_WEBHOOK_SECRET` in your env.

Our webhook:
- Accepts `POST` with JSON body `{ "PaymentId": "..." }` (and possibly other fields).
- Always returns HTTP 200 to prevent MyFatoorah retries — errors are logged internally.
- Verifies payment server-side via `GetPaymentStatus` before any DB update.
- Is idempotent: duplicate calls for an already-PAID payment are detected and no double-credit occurs.

---

## Payment Verification (GetPaymentStatus)

We call `POST /v2/GetPaymentStatus` inside the webhook handler with:
```json
{ "Key": "<PaymentId>", "KeyType": "PaymentId" }
```

The response `Data.InvoiceStatus` maps as:
- `"Paid"` → `PAID`
- `"Failed"` / `"Expired"` → `FAILED`
- anything else → `PENDING`

We only update the database to PAID after server-side confirmation via this call.

---

## Idempotency

### Webhook Idempotency

Before processing any webhook:
1. Find the `Payment` record by `invoiceId` or `externalRef`.
2. If `payment.status === 'PAID'` → log `PAYMENT_WEBHOOK_DUPLICATE_IGNORED`, return 200. No DB changes.
3. Only proceed to credit wallet or activate subscription if status is not already PAID.

**Result**: Duplicate webhook calls do not double-credit the wallet or double-activate subscriptions.

### Subscription Payment Idempotency

Before creating a new MyFatoorah invoice for a subscription:
1. Check if a `Payment` row already exists for this `subscriptionId` with `status = 'PENDING'`.
2. If yes, return the existing payment info instead of creating a new invoice.
3. This prevents multiple pending invoices for the same subscription.

### Wallet Balance Safety

Inside `POST /api/wallet/pay-subscription`:
1. A Prisma `$transaction` re-reads the wallet balance inside the transaction.
2. Computes `newBalance = currentBalance - amount`.
3. If `newBalance < 0` → throws `Insufficient balance` → transaction rolls back.
4. The balance can never go negative through the wallet payment flow.

---

## Payment Status Transitions

Valid transitions:
- `PENDING` → `PAID` (via webhook after server-side verification)
- `PENDING` → `FAILED` (via webhook or invoice creation failure)

Invalid (enforced by idempotency check):
- `PAID` → `PENDING` (not possible)
- `FAILED` → subscription activation (not possible — only PAID triggers activation)

---

## What NOT to Do

- **Do not mark a payment PAID from the browser redirect URL alone.** MyFatoorah's redirect (callback) URL receives the user back to your app, but this redirect must not be trusted for payment confirmation. Always use the webhook + `GetPaymentStatus`.
- **Do not implement Direct Payment** (collecting card details in your form). This requires PCI DSS certification. Our implementation uses hosted invoice URLs only.
- **Do not fake payment success** when credentials are missing. The API returns a 503 with `"Payment gateway not configured"` if `MYFATOORAH_API_KEY` or `MYFATOORAH_BASE_URL` are not set.
- **Do not log or expose `MYFATOORAH_API_KEY`.** The API key is accessed via `process.env` server-side only. The `myfatoorah.ts` module uses `import 'server-only'` to prevent client-side imports. Client responses never include the API key.
- **Do not use production credentials in development.** Always use the demo API key with the demo base URL for testing.

---

## Missing Credentials Behavior

If `MYFATOORAH_API_KEY` or `MYFATOORAH_BASE_URL` are not set:

- `POST /api/payments/create` returns HTTP 503:
  ```json
  { "data": null, "error": { "message": "Payment gateway not configured. Contact support." } }
  ```
- The wallet UI shows this error message to the user.
- No payment record is created.
- No fake success occurs.

---

## Current Implementation Files

| File | Purpose |
|------|---------|
| `src/lib/payments/myfatoorah.ts` | Server-only MyFatoorah client — `createInvoice`, `getPaymentStatus` |
| `src/app/api/payments/create/route.ts` | Creates invoice, returns `invoiceUrl` for redirect |
| `src/app/api/payments/webhook/route.ts` | Receives webhook, verifies server-side, updates DB |
| `src/app/api/payments/route.ts` | Lists user's payments |
| `src/app/api/payments/[id]/route.ts` | Gets single payment |
| `src/app/api/wallet/route.ts` | Gets wallet balance |
| `src/app/api/wallet/pay-subscription/route.ts` | Deducts from wallet to pay subscription |
| `src/app/wallet/page.tsx` | Wallet UI with top-up |
| `src/app/subscriptions/page.tsx` | Subscriptions UI with Pay Online / Pay with Wallet |

---

## Remaining Blockers

1. **Real MyFatoorah credentials not yet available** — demo account activation required.
2. **Webhook endpoint requires public URL** — local development requires a tunnel (ngrok/Cloudflare Tunnel).
3. **Real database end-to-end testing** — the smoke tests cover validation logic only. DB integration tests against a real MySQL instance are still required.
4. **Webhook signature verification** — HMAC-SHA256 verification against the `Signature` header is implemented. Set `MYFATOORAH_WEBHOOK_SECRET` in `.env` to enable enforcement. Without it, signature verification is skipped with a server-side warning (acceptable for local dev without a real portal).
