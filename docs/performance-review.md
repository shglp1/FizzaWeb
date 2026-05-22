# Performance Review

Covers bottlenecks identified during Task 9, what was fixed, what remains, and SLOs for the 1000-concurrent-user target.

---

## SLOs (Service Level Objectives)

| Endpoint category | p95 latency target | Error rate target |
|---|---|---|
| Read endpoints (packages, add-ons, subscriptions list) | < 500 ms | < 1% |
| Admin endpoints (CRUD, audit logs) | < 800 ms | < 1% |
| ORS quote (distance + pricing) | < 1 000 ms | < 1% |
| GPS location update | < 300 ms | < 1% |
| Payment initiation | < 2 000 ms | < 0.5% |

---

## Bottlenecks Identified and Fixed

### 1. Missing indexes on `trips` table (Critical)

**Problem**: The `trips` table had zero indexes before Task 9. Every trip list query, status filter, and driver assignment check was a full table scan. At 1000 users this would cause multi-second queries and connection pile-up.

**Fix**: Added indexes in `prisma/schema.prisma` and `prisma/migrations/init_mysql_schema.sql`:
```
@@index([subscriptionId])
@@index([riderId])
@@index([driverId])
@@index([status])
@@index([scheduledDate])
@@index([legType])
@@index([createdAt])
```

### 2. Missing indexes on `driver_locations` table

**Problem**: The GPS tracking endpoint inserts a row per update and the tracking GET reads the latest location by `tripId`. Without indexes, location lookups were full scans.

**Fix**:
```
@@index([driverId])
@@index([tripId])
@@index([recordedAt])
```

### 3. Missing indexes on `notifications`, `audit_logs`, `driver_applications`

All three tables had zero indexes. Admin panels that list audit logs or notifications would hit full table scans.

**Fix**: Added `@@index([userId])`, `@@index([action])`, `@@index([createdAt])` on `AuditLog`; `@@index([userId])`, `@@index([isRead])`, `@@index([createdAt])` on `Notification`; `@@index([userId])`, `@@index([status])` on `DriverApplication`.

### 4. GPS update flooding (fixed with throttle)

**Problem**: A driver app could call POST `/api/tracking/[tripId]/location` many times per second, filling the `driver_locations` table and exhausting DB connections.

**Fix**: Added in-process `Map<driverId, lastTimestamp>` throttle — rejects updates faster than once every 5 seconds with HTTP 429. See `src/app/api/tracking/[tripId]/location/route.ts`.

**Remaining risk**: In-process throttle only works per Vercel function instance. Under multi-replica scaling a driver can submit updates at 5-second intervals to different instances, bypassing the throttle. Fix: replace with Redis sliding window (see Remaining Risks below).

### 5. No caching on price endpoints (fixed)

**Problem**: `/api/subscription-packages` and `/api/add-ons` were uncached. Every page load that renders pricing re-fetches from MySQL.

**Fix**: Added `Cache-Control: private, max-age=60, stale-while-revalidate=30` to both endpoints. Browsers cache the response for 60 seconds and serve stale for an additional 30 seconds while revalidating in background.

### 6. Payment amount drift (fixed in Task 8.7)

**Problem**: Payment creation was re-deriving the total from current package and add-on prices at payment time. If an admin changed a price between subscription creation and payment, the amount charged differed from what the user agreed to.

**Fix**: Payment routes now read `subscription.finalPriceSar` (stored at subscription creation time) and never re-derive from current prices.

---

## Connection Pooling

Vercel creates a new Lambda per request. Without a connection pool, each cold-started function opens a new MySQL connection. MySQL's default `max_connections` is 151. At 1000 concurrent users the connection limit will be reached immediately.

**Required fix before production**: Configure a pooled connection string from your MySQL provider (PgBouncer, PlanetScale's built-in pool, or Aiven's pooler). See `docs/database-setup.md`.

**Status**: ⚠️ BLOCKED — requires real hosted DB and provider pooling configuration.

---

## Remaining Risks

| Risk | Severity | Fix |
|---|---|---|
| No connection pooling | **Critical** | Configure pooled URL from DB provider |
| GPS throttle bypass in multi-replica | Medium | Replace in-process Map with Redis `SET NX PX` sliding window |
| ORS free tier rate limit (2 000 req/day) | High | Upgrade ORS plan or add server-side caching of distance results by route hash |
| No HTTP-level rate limiting | Medium | Add Vercel Edge rate limiting middleware or Upstash Redis rate limiter |
| No CDN caching for static assets | Low | Next.js handles this via Vercel Edge Network automatically |
| `SELECT *` patterns in some admin queries | Low | Refine `select` clauses if profiling shows data transfer overhead |

---

## Query Patterns Reviewed

| Query | Index used | Notes |
|---|---|---|
| `Trip.findMany({ where: { driverId, status } })` | `idx_trips_driver_id` + `idx_trips_status` | Covered by composite or individual indexes |
| `Trip.findMany({ where: { subscriptionId } })` | `idx_trips_subscription_id` | Added Task 9 |
| `DriverLocation.findFirst({ where: { tripId }, orderBy: { recordedAt: 'desc' } })` | `idx_driver_locations_trip_id` + `idx_driver_locations_recorded_at` | Added Task 9 |
| `Notification.findMany({ where: { userId, isRead: false } })` | `idx_notifications_user_id` + `idx_notifications_is_read` | Added Task 9 |
| `AuditLog.findMany({ orderBy: { createdAt: 'desc' } })` | `idx_audit_logs_created_at` | Added Task 9 |
| `UserSubscription.findMany({ where: { paymentStatus } })` | `idx_user_subscriptions_payment_status` | Added Task 9 |

---

## Recommendations for Post-Launch

1. **Enable slow query log** in MySQL (queries > 500 ms) and review weekly.
2. **Add APM tracing** (e.g. Sentry Performance, Datadog APM) to measure real p95 latencies.
3. **Cache ORS distance results** by `(originLat, originLng, destLat, destLng)` hash with a 24-hour TTL — distances for common routes don't change.
4. **Add Redis** (Upstash or Railway Redis) for GPS throttle, rate limiting, and session caching.
5. **Review Prisma query logs** in development (`DEBUG="prisma:query"`) to identify N+1 patterns.
