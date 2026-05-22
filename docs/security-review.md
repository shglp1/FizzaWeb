# Security Review

Documents the security posture of FizzaWeb: what is protected, how, and what gaps remain before production launch.

---

## Authentication

| Check | Status | Notes |
|---|---|---|
| JWT signed with `SESSION_SECRET` (≥32 chars) | ✅ | Uses `jose` library; RS256-equivalent HS256 with strong secret |
| JWT validated on every protected request | ✅ | `requireAuth()` in `src/lib/session.ts` checks signature + expiry |
| JWT expiry enforced | ✅ | Token expires; client must re-authenticate |
| Passwords hashed with bcrypt | ✅ | `bcryptjs` with salt rounds ≥ 10 |
| No plaintext passwords stored or logged | ✅ | Verified by code search |
| Session secret rotatable (invalidates all sessions) | ✅ | Documented in `docs/environment.md` |
| Admin-only routes protected by role check | ✅ | All `/api/admin/*` routes call `requireAuth()` and check `auth.role === 'ADMIN'` |

---

## Authorization

| Check | Status | Notes |
|---|---|---|
| Riders can only access their own subscriptions | ✅ | `userId: auth.userId` filter on all subscription queries |
| Riders can only cancel subscriptions they own | ✅ | Ownership validated before status change |
| Drivers can only update GPS for trips assigned to them | ✅ | `driverId: driver.id` filter on trip lookup |
| Drivers can only update their own profile | ✅ | Profile ID matched against auth token |
| Admin actions logged to `AuditLog` | ✅ | All admin mutations write an audit entry |
| Cross-user data access prevented | ✅ | No endpoint returns data for arbitrary user IDs without admin role |

---

## Payment Security

| Check | Status | Notes |
|---|---|---|
| Payment amount derived from stored snapshot, not current price | ✅ | Fixed in Task 8.7: reads `subscription.finalPriceSar` |
| MyFatoorah webhook HMAC verified before processing | ✅ | `MYFATOORAH_WEBHOOK_SECRET` used to verify signature |
| Webhook endpoint rejects invalid signatures | ✅ | Returns 400 on HMAC mismatch |
| API keys server-side only (never in browser) | ✅ | `MYFATOORAH_API_KEY` and `OPENROUTESERVICE_API_KEY` not prefixed `NEXT_PUBLIC_` |
| No financial data logged | ✅ | Verified by code search — amounts logged only as structured audit entries |

---

## Input Validation

| Check | Status | Notes |
|---|---|---|
| All API inputs validated with Zod schemas | ✅ | Every POST/PATCH route parses body through a schema before touching DB |
| UUID format enforced for ID params | ✅ | Route IDs validated; Prisma rejects non-UUID strings |
| SQL injection prevented | ✅ | Prisma ORM uses parameterized queries exclusively |
| XSS on user inputs | ✅ | React escapes output by default; no `dangerouslySetInnerHTML` usage |
| File upload size enforced | ✅ | `UPLOAD_MAX_SIZE_MB` env var caps upload size |

---

## Rate Limiting

| Check | Status | Notes |
|---|---|---|
| GPS location update throttle | ✅ | 5-second minimum interval per driver (in-process Map) |
| Login brute-force protection | ⚠️ **GAP** | No rate limiting on `/api/auth/login`. Add Vercel Edge rate limiting or Upstash Redis |
| API-level rate limiting | ⚠️ **GAP** | No global rate limiter. Add `middleware.ts` edge rate limiting before production |
| ORS quota guard | ⚠️ **GAP** | No server-side guard preventing ORS quota exhaustion from many quote requests |

---

## Secrets and Environment

| Check | Status | Notes |
|---|---|---|
| `.env` in `.gitignore` | ✅ | Real credentials never committed |
| Only `.env.example` with placeholders committed | ✅ | Verified |
| No hardcoded secrets in source code | ✅ | Verified by code search |
| `NEXT_PUBLIC_` prefix used only for truly public values | ✅ | Only `NEXT_PUBLIC_MAPBOX_TOKEN` uses this prefix |
| Mapbox token restricted to domain | ⚠️ **ACTION REQUIRED** | Must be restricted in Mapbox dashboard before production |

---

## Infrastructure

| Check | Status | Notes |
|---|---|---|
| HTTPS enforced | ✅ | Vercel provides TLS by default |
| CORS policy | ✅ | Next.js API routes only respond to same-origin by default |
| Security headers | ⚠️ **GAP** | No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` headers set. Add via `next.config.ts` `headers()` |
| Dependency vulnerabilities | ✅ | `npm audit --audit-level=high` passes (part of `npm run verify`) |
| Admin panel not publicly discoverable | ⚠️ **INFO** | `/admin` route is protected by auth but not obscured. Consider adding basic auth or IP allowlist for extra security |

---

## Recommended Pre-Launch Security Actions

1. **Add rate limiting to `/api/auth/login`** — Upstash Redis rate limiter in `middleware.ts` is the recommended approach for Vercel.
2. **Add HTTP security headers** in `next.config.ts`:
   ```ts
   async headers() {
     return [{
       source: '/(.*)',
       headers: [
         { key: 'X-Content-Type-Options', value: 'nosniff' },
         { key: 'X-Frame-Options', value: 'DENY' },
         { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
       ],
     }];
   }
   ```
3. **Restrict Mapbox token** to production domain in the Mapbox dashboard.
4. **Upgrade ORS plan** or add server-side distance result caching to prevent quota exhaustion.
5. **Enable Vercel WAF** (available on Pro plan) for additional bot and DDoS protection.
