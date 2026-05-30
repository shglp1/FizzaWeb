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

**Status**: ✅ RESOLVED — `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, and `Permissions-Policy` are all configured in the `headers()` function in `next.config.ts`.

---

## 🟡 Important (should fix before launch)

### 6. GPS throttle: Redis replacement for multi-replica

A server-side GPS write throttle is implemented in `src/lib/tracking/gpsThrottle.ts` (in-process `Map<tripId, timestamp>`, default 4s cooldown via `GPS_THROTTLE_MS`). It runs in the tracking POST route **after** all auth/ownership/sharing checks, so it never weakens security, and it returns `{ ok: true, throttled: true }` without persisting when within the cooldown window.

**Limitation**: This is per-instance. On a multi-instance / serverless deployment (e.g. Vercel auto-scaling), each instance keeps its own map, so the effective window is per-instance, not global. It is still a strict improvement everywhere and is fully correct for single-instance deployments.

**What to do for multi-instance**: Replace with `SET tripId NX PX 4000` in Upstash Redis. The same applies to the in-memory live-ETA cache (`src/lib/tracking/liveEtaCache.ts`).

**Status**: ✅ In-memory throttle implemented (perf audit). ⚠️ Redis upgrade still required before multi-instance deployment — estimated 1–2 hours.

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

## Implemented Enterprise Audit Fixes (May 2026)

The following gaps were identified in the Enterprise Audit (Phases 1–17) and resolved in the Phase 18 implementation pass:

### GPS Sharing: Manual vs Auto-Start

`DriverGpsPanel` now supports two modes:

| Mode | Behaviour |
|---|---|
| **Manual** (default) | Driver taps "Enable GPS sharing". Used when `autoStart={false}`. |
| **Auto-start** | GPS sharing starts automatically when `autoStart={true}`, `permissionState === 'granted'`, `withinWindow`, and trip status is an active status (`isActiveStatus()`). The driver does not need to tap anything. |
| **Auto-stop** | When `isTerminal={true}` (trip COMPLETED, CANCELLED, NO_SHOW), sharing stops automatically. |

`DriverTrackingView` wires `autoStart={isActiveStatus(trip.status)}` and `isTerminal` automatically. Drivers on active trips will have GPS start automatically once the browser has previously granted geolocation permission.

**Note**: GPS is stopped when the driver navigates away from the page (watchPosition cleanup on unmount). Persistent background GPS requires a Progressive Web App with a service worker — a future enhancement.

---

### Driver City and Service Area Matching

The `Driver` model now has `city` and `serviceArea` fields (nullable). These are populated automatically when an admin approves a `DriverApplication`: the values are copied from the application.

**Admin available-drivers endpoint** (`GET /api/admin/trips/[id]/available-drivers`) now returns:

| Field | Description |
|---|---|
| `city` | Driver's declared operating city |
| `serviceArea` | Driver's declared service area text |
| `availability` | Whether the driver is marked available |
| `lastGpsAt` | Timestamp of driver's last GPS update |
| `lastGpsAgeSeconds` | Age of last GPS update in seconds |
| `cityMatch` | `true`/`false`/`null` — whether driver city matches trip city (null if either is unknown) |

Drivers are now blocked from assignment if `availability === false` (on both the single-trip assign and subscription assign-driver endpoints, and the reassign endpoint).

---

## Summary

| Severity | Count | All resolved? |
|---|---|---|
| 🔴 Critical blockers | 4 | ❌ No (security headers resolved; 4 remain) |
| 🟡 Important pre-launch | 6 | ❌ No |
| 🟢 Nice to have | 5 | — |

**The application is code-complete and passes all automated checks (`npm run verify`). It is not production-ready until the critical blockers above are resolved.**
