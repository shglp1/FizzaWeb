# Finance / Ops — Wallet Credit Policy

## Purpose

This document defines when and how **CREDIT_PARENT** financial review decisions automatically credit a parent's internal Fizza wallet.

## When CREDIT_PARENT is allowed

- Trip status is **COMPLETED**
- Admin has resolved financial review with action **CREDIT_PARENT**
- Trip is linked to a **paid subscription** with a computable `finalPriceSar`
- A **reason** (minimum 3 characters) is provided
- Admin confirms the computed credit amount in the UI

## Amount calculation

```
expectedLegs = max(actualServiceDays × legsPerDay, subscriptionTripCount, 1)
legsPerDay = 2 if ROUND_TRIP else 1
creditAmount = round(finalPriceSar / expectedLegs, 2)
```

The admin must confirm the exact computed amount. Mismatch rejects the operation.

## Wallet credit vs payment gateway refund

| Action | Internal wallet | Payment gateway |
|--------|-----------------|-----------------|
| **CREDIT_PARENT** | **Automated** — creates `WalletTransaction` source `TRIP_FINANCIAL_CREDIT` | Not affected |
| **REFUND_PARENT** | Not automated | **Manual** — ops must process MyFatoorah/card refund separately |

## Authorization

- Only users with role **ADMIN** may trigger financial review or manual wallet adjustments
- All actions write **audit logs** (`TRIP_FINANCIAL_REVIEW`, `TRIP_WALLET_CREDIT`, `ADMIN_WALLET_ADJUSTED`)

## Idempotency

- One wallet credit per trip via unique `idempotency_key`: `trip-financial-credit:{tripId}`
- Trip field `wallet_credit_transaction_id` links the credit
- Retries return existing transaction without double-crediting

## Reconciliation steps

1. Export wallet transactions filtered by `source=TRIP_FINANCIAL_CREDIT`
2. Match `tripId` to financial review audit entries
3. Verify parent wallet balance changes equal sum of credits
4. REFUND_PARENT rows require separate payment reconciliation

## Failure handling

- All wallet updates run in a **single DB transaction**
- On failure, no partial balance update occurs
- Admin UI shows error message; admin may retry (idempotent if already succeeded)

## Manual adjustments

Admins may also credit/debit via **Users → Wallet operations** (`source=MANUAL_ADJUSTMENT`). These require a 10+ character reason and are separate from trip credits.
