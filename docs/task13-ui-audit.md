# Task 13 — UI/UX Audit Summary

Audit performed before implementation. Status: **addressed in branch `task/13-enterprise-ui-ux`**.

| Page / component | Current problem | UX risk | Proposed improvement | Files |
|------------------|-----------------|--------|----------------------|-------|
| Global EmptyState | Emoji strings as icons | Unprofessional | Lucide via `AppIcon` / `resolveEmptyIcon` | `components/ui/index.tsx`, `components/icons` |
| Landing `/` | Emoji feature bullets | Trust | Lucide icons in feature grid | `app/page.tsx` |
| Parent dashboard | Emoji quick actions | Inconsistent | Icon cards with lucide | `app/dashboard/page.tsx` |
| Notifications | Emoji per type | Scan difficulty | Lucide + badge colors | `app/notifications/page.tsx` |
| Tracking timeline | Emoji event icons | Ambiguity | Lucide event map | `app/tracking/[tripId]/page.tsx` |
| MapLocationPicker | No “use my location” | Friction | Geolocation CTA + fallback | `components/location/MapLocationPicker.tsx` |
| `/subscriptions/new` | Step names technical | Abandonment | Human step labels + sticky summary | `app/subscriptions/new/page.tsx` |
| Driver dashboard | Emoji empty/quick | Ops clarity | Lucide + route language | `app/driver/dashboard/page.tsx` |
| Admin sections | Emoji empty states | Ops clarity | Lucide empty states | `app/admin/sections/*` |
| Driver application | Emoji vehicle types | Applicant trust | Lucide vehicle icons | `app/driver-application/page.tsx` |
| TripOperationsBoard | Raw JSON drawer | Admin efficiency | Structured drawer (future polish) | `admin/sections/TripOperationsBoard.tsx` |
| MobileNav | Generally OK | — | Safe-area padding verified | `components/layout/MobileNav.tsx` |
| Forms | Mixed spacing | Errors | `.field`, `.label` tokens in globals | `styles/globals.css` |

## Design system tokens

- Spacing: `.page-header`, `.section-stack`, `.content-max`
- Typography: `.page-title`, `.page-subtitle`, `.section-title`
- Empty state: icon circle with lucide, no emoji span

## Remaining limitations

- Full admin trip drawer UI polish (structured panels vs JSON) deferred to follow-up
- RTL/Arabic layout not fully audited
- Skeleton loaders not added to every page (LoadingState used consistently)
