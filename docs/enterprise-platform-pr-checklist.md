# PR Checklist — feat/enterprise-platform-consistency

## Summary

Enterprise platform consistency + financial operations layer: automated wallet credit (CREDIT_PARENT), admin wallet adjustments, financial review queue, stale trip audit/remediation, vehicle images, payroll gates.

## Migration instructions

- [ ] Commit `prisma/migrations/migration_lock.toml`
- [ ] Commit `prisma/migrations/20260524120000_enterprise_platform_consistency/`
- [ ] Commit `prisma/migrations/20260529120000_wallet_credit_financial_ops/`
- [ ] Staging: `npx prisma migrate status` then `npx prisma migrate deploy`
- [ ] **Never** `migrate reset` in staging/production
- [ ] See `docs/enterprise-platform-deploy.md`

## Staging checklist

- [ ] `npm run audit:stale-trips` — review output manually
- [ ] `npm run audit:stale-trips -- --json` — export classification for ops record
- [ ] `npm run remediate:stale-trips` — dry-run only before any apply
- [ ] Resolve stale non-terminal trips via admin or explicit CLI apply
- [ ] Financial review PENDING queue cleared or acknowledged
- [ ] CREDIT_PARENT wallet credit tested end-to-end (confirm modal, idempotency)
- [ ] REFUND_PARENT confirmed as manual gateway refund only
- [ ] Parent wallet manual adjustment tested (credit + debit)
- [ ] Payroll test run excludes held/refund/credit trips
- [ ] Complete **`docs/staging-qa-wallet-financial-ops.md`** on staging

## Test results (local)

Run before merge:

```bash
npx prisma validate && npx prisma generate && npx prisma migrate status
npm run audit:stale-trips && npm run typecheck && npm run lint && npm test && npm run build
```

## Known limitations

- REFUND_PARENT = audit record + manual payment gateway refund (no MyFatoorah automation)
- CREDIT_PARENT amount = pro-rated subscription price (no per-trip billing field)
- Live ops = list + single-trip map (no fleet map)
- Vehicle images = local SVG fallbacks by body type
- Stale remediation = explicit CLI apply per trip (no bulk auto-close)

## Financial / Ops sign-off required

⚠️ **Do not merge to production** without:

- [ ] **Wallet credit policy reviewed** — `docs/finance-ops-wallet-credit-policy.md`
- [ ] **Manual wallet adjustment reviewed** — Users → parent wallet panel
- [ ] **Refund vs wallet credit distinction reviewed** — CREDIT_PARENT automated; REFUND_PARENT manual gateway
- [ ] **Stale trips reviewed** — audit output + remediation plan documented
- [ ] **Reconciliation report reviewed** — wallet transactions with `TRIP_FINANCIAL_CREDIT` source
- [ ] Staging migration verified
- [ ] Staging manual QA complete
- [ ] Finance sign-off on payroll held-trip + wallet credit behavior
- [ ] Ops sign-off on stale trip cleanup plan

## Files excluded from commit

`.env`, secrets, `.next`, cache, `public/uploads`
