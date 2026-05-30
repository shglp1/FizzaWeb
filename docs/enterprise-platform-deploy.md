# Enterprise Platform Consistency — Deployment Notes

## Before merge (local)

```bash
npx prisma validate
npx prisma generate
npx prisma migrate status   # expect: Database schema is up to date
npm run audit:stale-trips
npm run remediate:stale-trips   # dry-run only (default)
npm run typecheck
npm run lint
npm test
npm run build
```

## Migration files (must be committed)

- `prisma/migrations/migration_lock.toml`
- `prisma/migrations/20260524120000_enterprise_platform_consistency/migration.sql`
- `prisma/migrations/20260529120000_wallet_credit_financial_ops/migration.sql`

No destructive SQL (`DROP`, `TRUNCATE`, data deletion) in these migrations.

---

## Wallet credit safety notes

- **CREDIT_PARENT** creates an internal wallet credit via `processTripWalletCredit()` — idempotent per trip (`idempotency_key = trip-financial-credit:{tripId}`).
- **REFUND_PARENT** remains audit-only — does **not** call MyFatoorah or card refund APIs.
- Admin must confirm computed amount (`confirmAmountSar`) before credit is applied.
- Wallet balance + `WalletTransaction` are updated in a single DB transaction.
- Manual adjustments use `MANUAL_ADJUSTMENT` source via Users → parent wallet panel.

See `docs/finance-ops-wallet-credit-policy.md` for Finance/Ops policy.

**Staging QA:** complete `docs/staging-qa-wallet-financial-ops.md` before production.

---

## Staging deploy

**Do not use** `migrate dev` or `migrate reset` on staging.

1. **Check migration status**

   ```bash
   DATABASE_URL="<staging-url>" npx prisma migrate status
   ```

2. **Handle drift if needed** (e.g. `registration_source` already applied via `init_mysql_schema.sql`):

   ```bash
   DATABASE_URL="<staging-url>" npx prisma migrate resolve --applied <migration_name>
   ```

   Verify each environment separately — local resolution does not apply to staging.

3. **Apply migrations**

   ```bash
   DATABASE_URL="<staging-url>" npx prisma migrate deploy
   ```

4. **Read-only audit**

   ```bash
   npm run audit:stale-trips
   npm run audit:stale-trips -- --json   # classification export
   npm run remediate:stale-trips         # dry-run remediation preview
   ```

5. **Manual cleanup** — resolve stale / financial-review trips in admin:
   - Trip Operations board (stale, needs dispatch)
   - **Financial Review** section (`/admin?section=financial-review`)
   - Users → parent wallet for manual adjustments
   - Do **not** run destructive SQL or auto-complete historical trips

6. **Staging sign-off** — ops + finance review:
   - CREDIT_PARENT wallet credit flow (confirm modal, idempotency, audit log)
   - REFUND_PARENT manual gateway refund workflow
   - Payroll held-trip behavior
   - Stale trip remediation plan

---

## Production deploy

Same as staging. **Never** `migrate reset` in production.

1. `migrate status` → `migrate deploy`
2. `audit:stale-trips` (read-only) + `--json` export for ops record
3. Manual stale/financial review resolution
4. Monitor payroll generation skips for first cycle
5. Spot-check wallet credits: `WalletTransaction.source = TRIP_FINANCIAL_CREDIT`

### Rollback plan

- **Application:** revert deploy to previous release (no schema rollback required if migration not applied)
- **If migration applied but app reverted:** new columns/tables remain nullable — old app continues; do not drop columns
- **If migration partially failed:** use `migrate resolve` after fixing root cause; never `migrate reset` on prod
- **Wallet credits already applied:** cannot be reversed by app rollback — use manual debit adjustment with audit reason if correction needed
- **Financial review data:** audit logs + trip `financial_review_*` columns are append-only decisions — corrections via new admin review entry + engineering if needed

---

## Stale trips remediation

**Default is dry-run.** No auto-delete or auto-complete.

```bash
# Preview (no mutations)
npm run remediate:stale-trips

# Explicit apply — one trip at a time
npm run remediate:stale-trips -- --apply --trip-id <uuid> --status CANCELLED --reason "..." --actor-id <admin-profile-id>
```

- Blocks remediation when `financialReviewStatus = PENDING`
- Writes `STALE_TRIP_REMEDIATION` audit log on apply
- Allowed statuses: `CANCELLED`, `NO_SHOW` only

---

## Post-deploy verification

- [ ] Admin Financial Review → CREDIT_PARENT → confirm modal → wallet credited once
- [ ] Duplicate CREDIT_PARENT returns idempotent success (no double credit)
- [ ] REFUND_PARENT shows gateway refund manual action (no wallet movement)
- [ ] Users → parent → wallet panel shows balance + transaction history with source labels
- [ ] `npm run audit:stale-trips` — review classification counts
- [ ] Payroll excludes PENDING / REFUND / CREDIT / INCIDENT trips

---

## Known limitations (acceptable for staging)

| Area | Limitation |
|------|------------|
| REFUND_PARENT | **Manual gateway refund only** — no MyFatoorah automation |
| CREDIT_PARENT | Pro-rated from subscription `finalPriceSar` — no per-trip billing field |
| Financial review | Queue + trip drawer; not a full accounting/ERP system |
| Live ops | List + optional single-trip read-only map; **no multi-driver live map** |
| Vehicle images | Local SVG fallbacks by body type; not per-model photos |
| Vehicle catalog | Config-only starter data; extend in `src/lib/vehicles/vehicleCatalog.ts` |
| Payroll period | UTC calendar month |
| Parent/driver lists | Classification cap 500 rows; UI shows truncation warning |
| Stale remediation | CLI with explicit flags; no bulk auto-close |

---

## Manual QA focus

- [ ] Admin **Financial Review** queue → resolve PENDING → payroll includes/excludes correctly
- [ ] CREDIT_PARENT → confirmation modal → wallet transaction reference shown
- [ ] REFUND_PARENT → **Payment gateway refund — manual action required**
- [ ] Users → parent wallet → manual credit/debit with reason
- [ ] Live ops → open trip drawer via deep link `?section=trips&tripId=`
- [ ] Vehicle display shows local image + make/model/year/plate
- [ ] `/admin-port` admin-only login

---

## Extending vehicle catalog

Edit `src/lib/vehicles/vehicleCatalog.ts`:

```typescript
{ make: 'YourMake', models: ['Model A', 'Model B'] }
```

Image fallbacks map by body type in `src/lib/vehicles/vehicleDisplay.ts`. Assets in `public/vehicles/`.
