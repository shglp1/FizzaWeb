# Role-Based UX — Task 10.1

Implementation notes for the three-role experience (Parent / Driver / Admin).

---

## Roles

| Role   | Primary dashboard       | Description                        |
|--------|-------------------------|------------------------------------|
| PARENT | `/dashboard`            | Family transport management        |
| DRIVER | `/driver/dashboard`     | Application status + assigned trips|
| ADMIN  | `/admin`                | Full platform management           |

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
| `/driver-application`  | ❌     | ✅     | ✅    |

---

## Middleware Rules (`middleware.ts`)

Server-side enforcement (runs on every non-API, non-static request):

1. **No token** → redirect to `/login?from=<path>`
2. **Invalid/expired token** → redirect to `/login`
3. **ADMIN + `/dashboard`** → redirect to `/admin`
4. **ADMIN + `/driver/dashboard`** → redirect to `/admin`
5. **DRIVER + `/dashboard`** → redirect to `/driver/dashboard`
6. **DRIVER + `/admin*`** → redirect to `/driver/dashboard`
7. **PARENT + `/admin*`** → redirect to `/dashboard`
8. **PARENT + `/driver/dashboard`** → redirect to `/dashboard`

Client-side role checks (UX fallback only, not a security boundary):
- `/dashboard` page → calls `/api/me`, redirects ADMIN/DRIVER on mismatch
- `/driver/dashboard` page → calls `/api/me`, redirects ADMIN/PARENT on mismatch

---

## Navigation Matrix

### PARENT Sidebar

**Main:** Dashboard · Riders · Subscriptions · Trips · Wallet · Safety · Notifications  
**Secondary:** Profile · Drive with Fizza (→ `/driver-application`)

### DRIVER Sidebar

**Main:** Driver Dashboard · Assigned Trips · GPS Tracking · Safety · Notifications  
**Secondary:** Profile · Application (→ `/driver-application`)

### ADMIN Sidebar

**Main:** Admin Panel · Notifications  
**Secondary:** Profile

### Mobile Nav

| Role   | Items                                     |
|--------|-------------------------------------------|
| PARENT | Home · Riders · Trips · Wallet · Profile  |
| DRIVER | Dashboard · Trips · GPS · Alerts · Profile|
| ADMIN  | Admin · Alerts · Profile                  |

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

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/roleRoutes.ts` | Core role routing logic: dashboards, nav items, route guards |
| `middleware.ts` | Server-side redirect enforcement (JWT decoded with `jose`) |
| `src/app/dashboard/page.tsx` | PARENT dashboard (wallet fix: `w.data.wallet.balanceSar`) |
| `src/app/driver/dashboard/page.tsx` | DRIVER dashboard (application status + trips) |
| `src/app/admin/page.tsx` | ADMIN dashboard (SectionRail + URL params + Suspense) |
| `src/app/admin/sections/AuditLogsSection.tsx` | Audit log viewer with action filter + pagination |
| `src/components/layout/Sidebar.tsx` | Role-aware desktop sidebar (fetches `/api/me`) |
| `src/components/layout/MobileNav.tsx` | Role-aware mobile bottom nav (fetches `/api/me`) |
| `src/app/forbidden/page.tsx` | 403 fallback page |
| `src/tests/roleRoutes.smoke.ts` | Unit smoke tests for roleRoutes helpers |

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

Safe display helper:
```ts
function safeBalance(wallet: { balanceSar: number } | null): string {
  const n = wallet?.balanceSar ?? 0;
  return `SAR ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}
```

---

## Security Boundary

- **Server-side middleware** is the authoritative access control (JWT verified via `jose`)
- **Client-side `/api/me` checks** are UX polish only (fast redirects on load)
- API routes are individually protected by `requireAuth`/`requireRole` in `src/lib/session.ts`
- Middleware matcher excludes `/api/*` to avoid interfering with server-side API auth
