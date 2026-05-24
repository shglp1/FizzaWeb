# Task 13.5 — Parent Portal UI/UX Audit

Branch: `task/13.5-parent-portal-redesign`  
Date: 2026-05-24

## Summary

Enterprise redesign of the Parent portal: design system, rider operational data, map fix, chat config, and page-level UX.

---

## 1. Family Dashboard (`/dashboard`)

| Item | Detail |
|------|--------|
| **Current problem** | Partial 13.1 upgrade; hero layout weak; trips lack driver/vehicle; attention list incomplete |
| **Why it hurts** | Parents cannot answer “what happens next?” at a glance |
| **Required redesign** | ParentHeroCard, KPI row, attention items, upcoming trips with driver/vehicle, quick actions |
| **Files** | `src/app/dashboard/page.tsx`, `src/components/parent/ParentUI.tsx` |
| **Done?** | YES |

---

## 2. Riders (`/riders`)

| Item | Detail |
|------|--------|
| **Current problem** | Inline form; minimal fields; no KPI or cards |
| **Why it hurts** | Missing safety/operational data for drivers and admin |
| **Required redesign** | Expanded schema, drawer form, KPI, ParentRiderCard |
| **Files** | `prisma/schema.prisma`, `src/app/riders/page.tsx`, `src/lib/validations/rider.ts`, `src/lib/riders/riderExposure.ts` |
| **Done?** | YES |

---

## 3. Subscriptions list (`/subscriptions`)

| Item | Detail |
|------|--------|
| **Current problem** | Basic cards; no filters; missing driver/vehicle |
| **Why it hurts** | Parents cannot see plan, driver, and payment status together |
| **Required redesign** | Filter tabs, ParentSubscriptionCard, assigned driver + vehicle |
| **Files** | `src/app/subscriptions/page.tsx`, `src/app/api/subscriptions/route.ts` |
| **Done?** | YES |

---

## 4. New Subscription wizard (`/subscriptions/new`)

| Item | Detail |
|------|--------|
| **Current problem** | Duplicate headings; broken Leaflet PNG markers; no photos; English-only map |
| **Why it hurts** | Broken map and confusing step UX block conversion |
| **Required redesign** | Remove duplicate titles; DivIcon markers; EN/AR search; optional location photos |
| **Files** | `src/app/subscriptions/new/page.tsx`, `src/components/location/MapLocationPicker.tsx`, `src/app/api/subscriptions/location-photo/route.ts` |
| **Done?** | YES |

---

## 5. Parent Trips (`/trips`)

| Item | Detail |
|------|--------|
| **Current problem** | Basic list; driver/vehicle not prominent |
| **Why it hurts** | Safety requires knowing who is driving and how to track |
| **Required redesign** | ParentTripCard, tabs, tracking status, chat/track actions |
| **Files** | `src/app/trips/page.tsx`, `src/app/api/trips/route.ts` |
| **Done?** | YES |

---

## 6. Wallet (`/wallet`)

| Item | Detail |
|------|--------|
| **Current problem** | Functional but basic; flat transaction list |
| **Why it hurts** | Payment clarity affects trust |
| **Required redesign** | Balance hero, grouped history, tx drawer |
| **Files** | `src/app/wallet/page.tsx` |
| **Done?** | YES |

---

## 7. Parent navigation

| Item | Detail |
|------|--------|
| **Current problem** | Shared shell OK; mobile omits Subscriptions (by design — bell for notifications) |
| **Why it hurts** | Minor — desktop labels already correct |
| **Required redesign** | Sticky sidebar, safe-area mobile nav (existing AppShell) |
| **Files** | `src/components/layout/Sidebar.tsx`, `src/lib/roleRoutes.ts`, `src/lib/mobileNav.ts` |
| **Done?** | YES (existing layout meets Part J; no driver/admin leakage) |

---

## 8. Chat & Moderation System Config

| Item | Detail |
|------|--------|
| **Current problem** | Empty chat group; hardcoded 20/30 min windows |
| **Why it hurts** | Ops cannot tune chat timing |
| **Required redesign** | Six config keys; runtime load in chat API |
| **Files** | `src/lib/ui/systemConfigGroups.ts`, `src/lib/chat/chatConfig.ts`, `src/lib/trips/tripLifecycle.ts`, `src/app/api/trips/[id]/chat/route.ts` |
| **Done?** | YES |

---

## Mobile 390px checklist

- [x] Dashboard stacks KPI 2-col; no horizontal overflow
- [x] Riders drawer full-screen on mobile
- [x] Subscription wizard summary stacks below form on lg breakpoint
- [x] Map height fixed 260px; EN/AR toggle compact
- [x] Bottom nav safe-area via AppShell `pb-24`
- [x] Touch targets min 44px on filter tabs and buttons

---

## Remaining limitations

- ORS geocoding returns best-effort Arabic/English labels; no guaranteed Arabic place names for all queries.
- Location photos use local storage only (`STORAGE_DRIVER=local`).
- Subscription “next trip” on list cards requires separate trip query (not preloaded on list API).
- Medical/allergy fields stored for parent/admin but withheld from driver view per exposure rules.
