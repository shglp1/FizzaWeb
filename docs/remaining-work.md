# Remaining Work

Honest list of blockers and gaps that must be resolved before FizzaWeb can go to production. Items are categorized by severity.

---

## 🔴 Critical Blockers (must fix before launch)

### 1. Database connection pooling

**Why it matters**: Vercel creates a new Lambda per request. Without pooling, 1000 concurrent users will exhaust MySQL's `max_connections` (default: 151) in seconds, causing cascading connection errors.

**What to do**: Configure a pooled `DATABASE_URL` from your MySQL provider (PgBouncer via Railway, PlanetScale built-in, Aiven pooler, or DigitalOcean connection pool). See `docs/database-setup.md`.

**Status**: ⚠️ BLOCKED — requires real hosted database.

---

### 2. Real credentials and environment variables

All payment, distance, and database functionality requires real API keys. None have been configured in a live environment.

- `DATABASE_URL` — hosted MySQL
- `SESSION_SECRET` — generate with `openssl rand -base64 32`
- `MYFATOORAH_API_KEY` — obtain from MyFatoorah merchant portal
- `MYFATOORAH_WEBHOOK_SECRET` — set in MyFatoorah webhook settings
- `OPENROUTESERVICE_API_KEY` — obtain from ORS dashboard

**Status**: ⚠️ BLOCKED — requires merchant accounts and real database.

---

### 3. Database migrations on production

`prisma migrate deploy` has not been run against a real hosted database. Schema and all indexes exist in code but are not applied anywhere.

**Status**: ⚠️ BLOCKED — depends on blocker #2.

---

### 4. Login rate limiting

The `/api/auth/login` endpoint has no brute-force protection. An attacker can attempt unlimited password guesses.

**What to do**: Add Upstash Redis rate limiter in `middleware.ts` (5 failed attempts per IP per 15 minutes). Upstash has a free tier compatible with Vercel.

**Status**: ⚠️ Not implemented — estimated 2–4 hours to implement.

---

### 5. HTTP security headers

No `Content-Security-Policy`, `X-Frame-Options`, or `X-Content-Type-Options` headers are set. Required for passing standard security audits.

**What to do**: Add a `headers()` function to `next.config.ts`. See `docs/security-review.md` for the recommended configuration.

**Status**: ⚠️ Not implemented — estimated 30 minutes.

---

## 🟡 Important (should fix before launch)

### 6. GPS throttle: Redis replacement for multi-replica

The current in-process `Map<driverId, timestamp>` throttle only works on a single Vercel function instance. Under auto-scaling, drivers can bypass the throttle by hitting different replicas.

**What to do**: Replace with `SET driverId NX PX 5000` in Upstash Redis.

**Status**: ⚠️ Not implemented — estimated 1–2 hours.

---

### 7. ORS quota caching

The ORS free tier allows ~2 000 requests/day. Frequent subscription creation (or load testing) will exhaust this quota.

**What to do**: Cache distance calculation results by route hash (origin+destination lat/lng rounded to 3 decimal places) in Redis with a 24-hour TTL.

**Status**: ⚠️ Not implemented — estimated 2–4 hours.

---

### 8. Mapbox token domain restriction

The `NEXT_PUBLIC_MAPBOX_TOKEN` is exposed to the browser. Without domain restriction in the Mapbox dashboard, anyone who sees it can use it against your quota.

**What to do**: Log in to Mapbox → Account → Access tokens → Restrict to your production domain.

**Status**: ⚠️ ACTION REQUIRED in Mapbox dashboard — 5 minutes.

---

### 9. End-to-end payment testing with MyFatoorah test mode

No payment flow has been tested with real (test-mode) MyFatoorah credentials. The implementation follows the documented API, but webhook delivery and callback URL handling have not been validated end-to-end.

**Status**: ⚠️ BLOCKED — requires MyFatoorah test account and staging environment.

---

### 10. Health endpoint

There is no `GET /api/health` endpoint. Uptime monitors and deployment health checks have nothing to ping.

**What to do**: Add `src/app/api/health/route.ts` returning `{ status: "ok" }`.

**Status**: ⚠️ Not implemented — estimated 10 minutes.

---

## 🟢 Nice to Have (can launch without)

### 11. File upload implementation

`STORAGE_DRIVER` and `UPLOAD_MAX_SIZE_MB` are configured but only URLs are stored. Full upload to S3 or local disk is not implemented.

### 12. Structured JSON logging

API routes use `console.error` but don't emit structured logs with request IDs or user context. Add once a log aggregator (Axiom, Logtail) is chosen.

### 13. Admin dashboard charts

The admin panel shows raw data tables. Charts for trip volume, revenue, and subscription growth would improve operational visibility.

### 14. Email notifications

Notifications are stored in the database (`Notification` table) but no email is sent. Integrate SendGrid, Resend, or AWS SES for email delivery.

### 15. Push notifications

No mobile push notification system. Would require a mobile app or PWA with a push service (FCM, APNs).

---

## Summary

| Severity | Count | All resolved? |
|---|---|---|
| 🔴 Critical blockers | 5 | ❌ No |
| 🟡 Important pre-launch | 6 | ❌ No |
| 🟢 Nice to have | 5 | — |

**The application is code-complete and passes all automated checks (`npm run verify`). It is not production-ready until the critical blockers above are resolved.**
