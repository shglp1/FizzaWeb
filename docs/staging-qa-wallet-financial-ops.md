# Staging QA Checklist — Wallet & Financial Operations

Use this checklist after `npx prisma migrate deploy` on staging and before production promotion.

**Sign-off:** Finance _______________ · Ops _______________ · Date _______________

---

## 1. CREDIT_PARENT end-to-end

- [ ] Open `/admin?section=financial-review` → **Pending review** tab
- [ ] Select a completed trip with `financialReviewStatus = PENDING` and valid subscription
- [ ] Choose **Credit parent wallet (automated)**
- [ ] Confirm preview shows: parent name, trip ID, computed SAR amount, subscription explanation
- [ ] Enter reason (min 3 chars) → **Review & confirm wallet credit**
- [ ] Confirm modal shows amount and parent → **Credit wallet**
- [ ] Success: **Wallet credit processed** badge + wallet transaction reference in trip drawer
- [ ] Verify parent wallet balance increased by exact computed amount (Users → parent → Wallet operations)
- [ ] Verify transaction appears with source **Automated trip credit** and **Processed by** admin name
- [ ] Verify `AuditLog` entries `TRIP_FINANCIAL_REVIEW` and `TRIP_WALLET_CREDIT` (optional DB check)
- [ ] Trip removed from **Payment action required** queue after credit

---

## 2. Duplicate retry / double-click

- [ ] Repeat CREDIT_PARENT on same trip (or double-click confirm quickly)
- [ ] Response is success with `duplicate: true` — **not** HTTP 500
- [ ] UI shows *Wallet credit already processed (idempotent)* or existing transaction ref
- [ ] Parent wallet balance **unchanged** (no second credit)
- [ ] Only one `WalletTransaction` with `idempotency_key = trip-financial-credit:{tripId}`

---

## 3. Manual wallet credit / debit

- [ ] Admin → Users → open a **parent** user
- [ ] **Wallet operations** section visible with current balance
- [ ] **Credit wallet**: enter amount + reason (min 10 chars) → balance increases
- [ ] Transaction listed as **Manual admin adjustment** with reason and **Processed by** admin
- [ ] **Debit wallet**: enter amount + reason → balance decreases (rejects if negative)
- [ ] Optional trip ID link stored on transaction when provided
- [ ] Non-admin user cannot access `/api/admin/wallet-adjustments` (403)

---

## 4. REFUND_PARENT remains manual

- [ ] Resolve a trip with **Refund parent (gateway/manual — audit record)**
- [ ] No wallet balance change
- [ ] No payment gateway / MyFatoorah call triggered
- [ ] UI shows **Payment gateway refund — manual action required**
- [ ] Trip appears in **Payment action required** tab until gateway refund processed externally
- [ ] Finance confirms refund handled via separate payment ops workflow

---

## 5. Stale trips dry-run / remediation

- [ ] Run `npm run audit:stale-trips` — review counts (no data mutation)
- [ ] Run `npm run audit:stale-trips -- --json` — export classification for ops record
- [ ] Run `npm run remediate:stale-trips` — confirms **DRY RUN** (no changes)
- [ ] Apply one test trip explicitly:
  ```bash
  npm run remediate:stale-trips -- --apply --trip-id <uuid> --status CANCELLED --reason "Staging QA remediation test" --actor-id <admin-profile-id>
  ```
- [ ] Verify `STALE_TRIP_REMEDIATION` audit log written
- [ ] Verify trip with `financialReviewStatus = PENDING` **cannot** be remediated via CLI
- [ ] Confirm no bulk auto-delete or auto-complete occurred

---

## 6. Finance approval of credit formula

Finance must explicitly approve before production:

- [ ] Formula documented: `subscription.finalPriceSar ÷ expected trip legs`
- [ ] Expected legs = `serviceDays × (1 or 2 for round-trip)`, floored at subscription trip count
- [ ] Sample trip reviewed: computed amount matches Finance expectation
- [ ] Distinction understood: **wallet credit ≠ payment gateway refund**
- [ ] Reconciliation query reviewed: `WalletTransaction` where `source = TRIP_FINANCIAL_CREDIT`
- [ ] Correction path agreed: manual debit adjustment + audit reason if wrong credit applied

**Finance sign-off on formula:** _______________ Date: _______________

---

## Pass criteria

All sections checked. Any failure blocks production promotion until resolved or documented exception approved by Finance + Engineering.
