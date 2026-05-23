# Role-Based UX — Tasks 10.1 / 10.2 / 10.3

Implementation notes for the four-state experience:
**Parent / Driver Applicant / Approved Driver / Admin**

---

## Roles and States

| JWT Role | Driver Application | `driverState`    | Primary destination       |
|----------|--------------------|------------------|---------------------------|
| `ADMIN`  | —                  | `ADMIN`          | `/admin`                  |
| `DRIVER` | —                  | `APPROVED_DRIVER`| `/driver/dashboard`       |
| `PARENT` | None               | `PARENT`         | `/dashboard`              |
| `PARENT` | PENDING / NEEDS_CHANGES / REJECTED | `APPLICANT` | `/driver-application` |
| `PARENT` | APPROVED (JWT not refreshed yet) | `APPLICANT` | `/driver-application` → prompts re-login |

### Why two layers?

**Middleware** (Edge runtime, runs before every page render) can only read the JWT cookie.
It cannot query the database — Edge does not support Node.js DB drivers.
So middleware knows only `role: PARENT | DRIVER | ADMIN`.

**`GET /api/me`** (normal Node.js API route) can query the database.
It fetches profile + driver application, computes `driverState`, and returns it to the client.
This is the single source of truth for client-side navigation state.

---

## Route Access Matrix

| Route                  | PARENT | DRIVER | ADMIN |
|------------------------|--------|--------|-------|
| `/dashboard`           | ✅     | ❌→redirect| ❌→redirect |
| `/driver/dashboard`    | ❌→redirect | ✅ | ❌→redirect |
| `/admin`               | ❌→redirect | ❌→redirect | ✅ |
| `/trips`               | ✅     | ✅     | ✅    |
| `/profile`             | ✅     | ✅     | ✅    |
| `/notifications`       | ✅     | ✅     | ✅    |
| `/riders`              | ✅     | ❌     | ✅    |
| `/wallet`              | ✅     | ❌     | ✅    |
| `/subscriptions`       | ✅     | ❌     | ✅    |
| `/safety`              | ✅     | ✅     | ✅    |
| `/tracking`            | ✅     | ✅     | ✅    |
| `/driver-application`  | ✅     | ❌→redirect | ✅ |
| `/drive`               | public | public | public |
| `/driver/login`        | public | public | public |
| `/driver/register`     | public | public | public |

---

## Middleware Rules (`middleware.ts`)

Server-side enforcement (runs on every non-API, non-static request):

1. **No token** → redirect to `/login?from=<path>`
2. **Invalid/expired token** → redirect to `/login`
3. **ADMIN + `/dashboard`** → redirect to `/admin`
4. **ADMIN + `/driver/dashboard`** → redirect to `/admin`
5. **DRIVER + `/dashboard`** → redirect to `/driver/dashboard`
6. **DRIVER + `/admin*`** → redirect to `/driver/dashboard`
7. **DRIVER + `/driver-application*`** → redirect to `/driver/dashboard`
8. **PARENT + `/admin*`** → redirect to `/dashboard`
9. **PARENT + `/driver/dashboard`** → redirect to `/dashboard`

Client-side role checks (UX fallback only, not a security boundary):
- `/dashboard` page → calls `/api/me`, redirects ADMIN/DRIVER on mismatch
- `/driver/dashboard` page → calls `/api/me`, redirects ADMIN/PARENT on mismatch

---

## `GET /api/me` — Client Session Summary

Normal API route (Node.js, has DB access). Returns session-specific data.

**Response shape:**
```json
{
  "data": {
    "userId": "...",
    "role": "PARENT | DRIVER | ADMIN",
    "profile": {
      "fullName": "...",
      "phone": "...",
      "avatarUrl": "..."
    },
    "driverApplication": {
      "id": "...",
      "status": "PENDING | NEEDS_CHANGES | REJECTED | APPROVED",
      "adminResponse": "...",
      "updatedAt": "ISO string"
    } | null,
    "driverState": "PARENT | APPLICANT | APPROVED_DRIVER | ADMIN"
  },
  "error": null
}
```

**Headers:** `Cache-Control: no-store` — never cache session-specific data.

**`driverState` mapping:**
- `role === ADMIN`  → `ADMIN`
- `role === DRIVER` → `APPROVED_DRIVER`
- `role === PARENT` + no application → `PARENT`
- `role === PARENT` + any application (including APPROVED) → `APPLICANT`

**PARENT + APPROVED application (JWT not refreshed yet):**
When an admin approves a driver application, the backend upgrades the user's DB role
to `DRIVER`. However the user's existing JWT still contains `PARENT`. Until they log
out and back in (receiving a new JWT with `DRIVER` role), `/api/me` returns
`driverState = "APPLICANT"` with `driverApplication.status = "APPROVED"`.
The approved card on `/driver-application` displays:
> "If the Driver Dashboard is not available yet, please sign out and sign back in."

---

## `useCurrentUser()` Hook

**File:** `src/hooks/useCurrentUser.ts`

A lightweight client hook that fetches `/api/me` once per page lifecycle.

**Key design:** module-level Promise singleton for request deduplication.
When Sidebar and MobileNav both call `useCurrentUser()`, only **one HTTP request**
is made. Both components wait on the same Promise and update their local state
when it resolves.

**Returns:** `{ user, loading, error, refetch }`

**Usage:**
```ts
const { user, loading } = useCurrentUser();
const driverState = user?.driverState ?? 'PARENT';
```

### Before Task 10.3 (two calls per component, total 4 per page):
```
Sidebar:    GET /api/me → GET /api/driver-application
MobileNav:  GET /api/me → GET /api/driver-application
```

### After Task 10.3 (one shared call, total 1 per page):
```
Sidebar:    useCurrentUser() ─┐
MobileNav:  useCurrentUser() ─┴─ GET /api/me (shared Promise)
```

---

## Navigation Matrix by `driverState`

### `PARENT` Sidebar

**Main:** Dashboard · Riders · Subscriptions · Trips · Wallet · Safety · Notifications
**Secondary:** Profile · Drive with Fizza (→ `/driver-application`)

### `APPLICANT` Sidebar (PARENT role with pending/rejected application)

**Main:** My Application · Notifications
**Secondary:** Profile
**Footer link:** Driver Portal (→ `/drive`)

### `APPROVED_DRIVER` Sidebar

**Main:** Driver Dashboard · Assigned Trips · GPS Tracking · Safety · Notifications
**Secondary:** Profile

### `ADMIN` Sidebar

**Main:** Admin Panel · Notifications
**Secondary:** Profile

### Mobile Nav

| driverState      | Items                                          |
|------------------|------------------------------------------------|
| `PARENT`         | Home · Riders · Trips · Wallet · Profile       |
| `APPLICANT`      | Application · Alerts · Profile                 |
| `APPROVED_DRIVER`| Dashboard · Trips · GPS · Alerts · Profile     |
| `ADMIN`          | Admin · Alerts · Profile                       |

---

## Admin Dashboard Navigation

Admin uses a **section rail** (not horizontal tabs) to keep 12 sections navigable:

- **Desktop** (`lg+`): vertical `SectionRail` component on the left, content on the right
- **Mobile**: horizontal scrollable `MobileSectionPicker` pill strip
- **URL state**: `/admin?section=<key>` — bookmarkable, browser back/forward works
- **Suspense** wrapper required because `useSearchParams` needs it in Next.js App Router

### Sections

`overview` · `users` · `riders` · `drivers` · `applications` · `subscriptions` · `trips` · `financials` · `safety` · `packages` · `sysconfig` · `audit`

---

## Driver Portal Flow

1. **`/drive`** — public driver landing page (no auth required)
2. **`/driver/register`** → creates PARENT-role account → redirects to `/driver-application`
3. **`/driver-application`** → application form (PARENT with no application)
4. Admin reviews → sets status to PENDING → APPROVED / REJECTED / NEEDS_CHANGES
5. Admin approves → DB role upgraded to DRIVER
6. User re-logs in → JWT now contains `role: DRIVER` → redirected to `/driver/dashboard`

---

## `roleRoutes.ts` — Helper Reference

| Function | Input | Output |
|----------|-------|--------|
| `getDashboardPathForRole(role)` | `'ADMIN' \| 'DRIVER' \| 'PARENT'` | Dashboard path (middleware/fallback) |
| `getDashboardPathForDriverState(state)` | `DriverState` | Dashboard path (client-side) |
| `getNavigationForRole(role)` | JWT role string | `{ main, secondary }` nav (legacy) |
| `getNavigationForDriverState(state)` | `DriverState` | `{ main, secondary }` nav (preferred) |
| `getNavigationForApplicant()` | — | Restricted applicant nav (legacy) |
| `isApprovedDriver(role)` | string | `true` if `role === 'DRIVER'` |
| `isPendingDriverApplicant(status)` | string \| null | `true` if PENDING/NEEDS_CHANGES/REJECTED |
| `isRouteAllowedForRole(path, role)` | path, role | UX-layer route guard |
| `isRouteAllowedForApplicant(path)` | path | Applicant route guard |

**Preferred client-side pattern (Task 10.3+):**
Use `getNavigationForDriverState(driverState)` with `driverState` from `useCurrentUser()`.

**Legacy pattern (still valid for non-nav code):**
Use `getNavigationForRole(role)` + `getNavigationForApplicant()` when you only have JWT role.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/roleRoutes.ts` | Core routing logic: dashboards, nav items, route guards, DriverState helpers |
| `middleware.ts` | Server-side redirect enforcement (JWT role only — no DB) |
| `src/app/api/me/route.ts` | Client session summary with DB-enriched `driverState` |
| `src/hooks/useCurrentUser.ts` | Client hook — fetches `/api/me` once, deduplicates across Sidebar/MobileNav |
| `src/app/dashboard/page.tsx` | PARENT dashboard |
| `src/app/driver/dashboard/page.tsx` | DRIVER dashboard |
| `src/app/admin/page.tsx` | ADMIN dashboard (SectionRail + URL params + Suspense) |
| `src/app/driver-application/page.tsx` | Full application lifecycle (PENDING → APPROVED) |
| `src/app/drive/page.tsx` | Public driver landing page |
| `src/app/driver/login/page.tsx` | Driver sign-in (uses `driverState` for redirect) |
| `src/app/driver/register/page.tsx` | Driver registration → `/driver-application` |
| `src/components/layout/Sidebar.tsx` | Role-aware desktop sidebar (uses `useCurrentUser`) |
| `src/components/layout/MobileNav.tsx` | Role-aware mobile bottom nav (uses `useCurrentUser`) |
| `src/tests/roleRoutes.smoke.ts` | Smoke tests for role routing helpers |
| `src/tests/driverPortal.smoke.ts` | Smoke tests for driver portal state helpers |
| `src/tests/driverState.smoke.ts` | Smoke tests for DriverState mapping and navigation |

---

## Wallet API Bug Fix

**Old (broken):**
```ts
if (w.data) setWallet(w.data);  // w.data = { wallet: {...}, loyaltyPoints }
// then: wallet?.balance  →  undefined
```

**Fixed:**
```ts
if (w.data?.wallet) setWallet(w.data.wallet);  // w.data.wallet = { balanceSar, ... }
// then: safeBalance(wallet)  →  "SAR 12.50"
```

---

## Security Boundary

- **Server-side middleware** is the authoritative access control (JWT verified via `jose`)
- **`GET /api/me`** enriches client UX state only — not a security boundary
- **Client-side nav** is cosmetic — users cannot bypass middleware by changing nav
- API routes are individually protected by `requireAuth`/`requireRole` in `src/lib/session.ts`
- Middleware matcher excludes `/api/*` to avoid interfering with server-side API auth
- `GET /api/me` sets `Cache-Control: no-store` to prevent session data being served stale
