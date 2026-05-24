# Task 13.4 — Driver Portal UI/UX Audit

Audit date: 2026-05-24  
Branch: `task/13.4-driver-portal-redesign`

## Summary

The driver portal used shared parent-oriented pages with basic cards, orphaned route-sheet code at `/driver/trips`, parent copy on `/tracking`, and a fragile inline Leaflet map. This audit documents pre-redesign problems and tracks completion.

---

## 1. Driver Dashboard (`/driver/dashboard`)

| Field | Detail |
|-------|--------|
| **Current visual/UX problem** | Generic stat cards and flat trip list; no “next action” guidance; GPS guidance buried in sidebar column; no needs-attention panel. |
| **Why bad for driver ops** | Drivers opening the app need immediate answer: “What do I do next?” Current layout requires scanning a long list. |
| **Required redesign** | Hero “Today’s Route”, KPI row, needs-attention alerts, schedule preview (3–5 trips), quick actions. |
| **Files to change** | `src/app/driver/dashboard/page.tsx`, `src/components/driver/DriverUI.tsx` |
| **Done?** | YES |

---

## 2. Assigned Trips / Route Sheet (`/trips` for driver)

| Field | Detail |
|-------|--------|
| **Current visual/UX problem** | Shared parent trip cards; full route sheet existed at orphaned `/driver/trips`; no date tabs, weak time hierarchy, GPS panel only on shared page. |
| **Why bad for driver ops** | 40+ trips become an unreadable scroll; status actions not prominent; no route summary. |
| **Required redesign** | Route sheet with Today/Tomorrow/Week tabs, summary bar, time-first cards, status actions, pagination. |
| **Files to change** | `src/app/trips/page.tsx`, `src/components/driver/DriverRouteSheet.tsx`, `src/components/driver/DriverUI.tsx`, `src/lib/ui/driverPortal.ts` |
| **Done?** | YES |

---

## 3. GPS Tracking list (`/tracking`)

| Field | Detail |
|-------|--------|
| **Current visual/UX problem** | Parent copy (“Track your child's active trips”); no GPS permission card; no tracking window states. |
| **Why bad for driver ops** | Drivers don’t know when to start sharing or whether GPS is active. |
| **Required redesign** | Driver-specific copy, eligibility cards, permission state, CTAs for start sharing / open map. |
| **Files to change** | `src/app/tracking/page.tsx`, `src/components/driver/DriverUI.tsx`, `src/lib/ui/driverPortal.ts` |
| **Done?** | YES |

---

## 4. GPS Tracking detail (`/tracking/[tripId]`)

| Field | Detail |
|-------|--------|
| **Current visual/UX problem** | Blank/broken map area; parent-only driver card; inline map with fragile Leaflet init; no driver GPS controls on page. |
| **Why bad for driver ops** | Core operational tool unusable; drivers can’t share GPS from tracking view. |
| **Required redesign** | Fixed map or professional fallback; DivIcon markers; polyline; role-aware panels; driver GPS sharing. |
| **Files to change** | `src/app/tracking/[tripId]/page.tsx`, `src/components/tracking/TripTrackingMap.tsx`, `src/components/DriverGpsPanel.tsx` |
| **Done?** | YES |

---

## 5. Safety Reports (`/safety`)

| Field | Detail |
|-------|--------|
| **Current visual/UX problem** | Generic list; manual Trip ID field; no KPI summary; basic header. |
| **Why bad for driver ops** | Hard to see report status at a glance; reporting friction during incidents. |
| **Required redesign** | Safety Center header, KPI row, polished cards, trip selector for drivers. |
| **Files to change** | `src/app/safety/page.tsx`, `src/components/driver/DriverUI.tsx`, `src/lib/ui/driverPortal.ts` |
| **Done?** | YES |

---

## 6. Notifications (`/notifications`)

| Field | Detail |
|-------|--------|
| **Current visual/UX problem** | Flat list; no Today/Earlier grouping; generic subtitle. |
| **Why bad for driver ops** | Urgent dispatch/trip alerts buried in chronological noise. |
| **Required redesign** | Grouped sections, category badges, unread controls, driver subtitle. |
| **Files to change** | `src/app/notifications/page.tsx`, `src/lib/ui/driverPortal.ts` |
| **Done?** | YES |

---

## 7. Sidebar / Mobile navigation

| Field | Detail |
|-------|--------|
| **Current visual/UX problem** | Labels “Assigned Trips”, “GPS Tracking”; mobile nav missing Notifications tab; not app-like. |
| **Why bad for driver ops** | Terminology doesn’t match driver mental model (route sheet, live GPS). |
| **Required redesign** | Dashboard, Route Sheet, Live GPS, Safety Center, Notifications, Profile; mobile bottom nav aligned. |
| **Files to change** | `src/lib/roleRoutes.ts`, `src/lib/mobileNav.ts` |
| **Done?** | YES |

---

## Typo route check

- `/saiftiy` — not found anywhere in codebase. No redirect needed.

---

## Mobile 390px checklist

| Page | Cards full width | No horizontal scroll | Thumb CTAs | Map responsive | Bottom nav safe |
|------|------------------|----------------------|------------|----------------|-----------------|
| `/driver/dashboard` | YES | YES | YES | N/A | YES |
| `/trips` (driver) | YES | YES | YES | N/A | YES |
| `/tracking` | YES | YES | YES | N/A | YES |
| `/tracking/[tripId]` | YES | YES | YES | YES | YES |
| `/safety` | YES | YES | YES | N/A | YES |
| `/notifications` | YES | YES | YES | N/A | YES |

---

## Remaining limitations

- “This Week” tab loads upcoming trips filtered client-side; server has no dedicated week range endpoint.
- Live GPS permission state is browser-dependent; denied state shown after user action only.
- Route polyline uses straight line between pickup/dropoff when no stored route geometry exists.
- Earnings/Support nav items not implemented (optional in spec).
