# Operations

Covers monitoring, logging, alerting, backup, and incident response for FizzaWeb in production.

---

## Logging

### Vercel Function Logs

All `console.error` and `console.log` calls from Next.js API routes appear in Vercel's **Functions** tab under the deployment.

- Vercel retains logs for **1 day** on the free/hobby plan, **7 days** on Pro.
- For persistent logging, integrate a log aggregator:

| Option | Notes |
|---|---|
| **Axiom** | Vercel-native integration; free tier generous; recommended |
| **Datadog** | Enterprise-grade; higher cost |
| **Logtail (Better Stack)** | Simple, affordable; good for small teams |

### What is logged today

- All `catch` blocks in API routes log `console.error` before returning `500`.
- Audit log entries written to the `AuditLog` table for all admin mutations.
- Payment webhook events logged to `AuditLog`.

### What should be added before production

- Structured JSON logging with request ID, user ID, and route context.
- Log the `action` and `userId` on every API request (not just admin ones).

---

## Monitoring

### Uptime Monitoring

Set up an uptime monitor to ping a health endpoint every minute:

Recommended health endpoint (add if not present):
```
GET /api/health → 200 OK { status: "ok" }
```

Services: **UptimeRobot** (free), **Better Stack**, **Vercel Monitoring** (Pro).

### Error Rate Monitoring

Integrate **Sentry** for exception tracking:

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Sentry captures uncaught exceptions and provides stack traces, request context, and user impact metrics.

### Performance Monitoring

- **Vercel Analytics** (built-in, free on Pro): tracks Core Web Vitals and page load times.
- **Vercel Speed Insights**: detailed performance waterfall for each route.
- For API p95 latency tracking, use Sentry Performance or Datadog APM.

---

## Alerting

Recommended alerts to configure:

| Alert | Threshold | Channel |
|---|---|---|
| Uptime check failing | > 1 minute down | Email + Slack |
| Error rate | > 2% of requests in 5 minutes | Email + Slack |
| MySQL CPU | > 80% for 5 minutes | Email |
| MySQL connections near max | > 90% of max_connections | Email |
| Payment webhook failure rate | > 5% in 1 hour | Email + Slack (critical) |
| Disk space (if using local storage) | > 80% full | Email |

---

## Database Backups

### Staging

No automated backup required. Restore from seed if needed.

### Production

| Provider | Backup recommendation |
|---|---|
| Railway | Enable automatic backups (paid plan, daily snapshots) |
| DigitalOcean Managed MySQL | 7-day automated daily backups included |
| AWS RDS | Enable automated snapshots, 7–35 day retention |
| Aiven | Automated backups included on all plans |

**Manual backup before risky migrations**:
```bash
mysqldump -h HOST -u USER -pPASSWORD DATABASE > backup_$(date +%Y%m%d_%H%M%S).sql
```

Test restore procedure at least once before go-live.

---

## Incident Response

### 500 errors spiking

1. Open Vercel → Functions tab → check error logs.
2. Check if a recent deployment caused the spike → rollback if so.
3. Check MySQL connection count — if near max, the DB is saturated (see `docs/database-setup.md` on pooling).

### Payment webhooks failing

1. Check MyFatoorah merchant portal → Webhook delivery log for error responses.
2. Verify `MYFATOORAH_WEBHOOK_SECRET` matches the value in the portal.
3. Verify `APP_URL` is correct and the webhook endpoint is reachable.
4. Manually replay failed webhooks from the portal if subscriptions are stuck in `PENDING`.

### GPS tracking unavailable

1. Confirm driver is authenticated (check JWT expiry).
2. Check if 429 throttle is firing too aggressively — reduce `GPS_MIN_INTERVAL_SECONDS` if needed.
3. If multi-replica, in-process throttle is not shared — upgrade to Redis-based throttle.

### ORS distance quote failing

1. Check ORS dashboard for quota usage (free tier: ~2 000/day).
2. If quota exhausted, upgrade ORS plan or wait until quota resets (midnight UTC).
3. Failure mode is a `503` with `NOT_CONFIGURED` or `SERVICE_UNAVAILABLE` — subscription creation will fail with a user-visible error, not silently.

---

## Scheduled Maintenance

- **Database index review**: Monthly — check `SHOW INDEX` and slow query log.
- **Dependency audit**: Weekly — `npm audit --audit-level=high` (part of `npm run verify`).
- **Rotate `SESSION_SECRET`**: Annually or after any suspected compromise (invalidates all sessions).
- **Review audit logs**: Weekly — check for suspicious admin actions.
