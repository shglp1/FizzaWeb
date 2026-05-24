# Task 13.2 — Admin UI Audit

Enterprise admin console redesign audit. All sections use shared components from `src/components/admin/AdminUI.tsx`.

| Section | Current visual/UX problem | Why it is bad for admin operations | Redesign approach | Files/components to change | Done? |
|---------|---------------------------|-------------------------------------|-------------------|---------------------------|-------|
| Users | Table-heavy, no detail drawer, weak KPI row | Hard to inspect account context quickly | KPI grid (total + types), toolbar, AdminTable + drawer with profile/wallet/subs | `UsersSection.tsx`, `AdminUI.tsx` | YES |
| Riders | Single stretched card list, no KPIs | Cannot assess fleet of students at a glance | KPI grid, card grid, detail drawer with parent/safety | `RidersSection.tsx`, `AdminUI.tsx` | YES |
| Drivers | Vehicle info floated far from identity | Dispatch decisions require scanning | Operational KPIs, unified cards, drawer with vehicle/workload | `DriversSection.tsx`, `AdminUI.tsx` | YES |
| Driver Applications | Plain review cards, no workflow feel | Review queue lacks priority visibility | Status KPIs, polished tabs, review drawer with actions | `ApplicationsSection.tsx`, `AdminUI.tsx` | YES |
| Packages & Add-ons | Basic list, weak product UI | Product management needs counts and structure | Header metrics, tabs, product cards, inline forms | `PackagesSection.tsx`, `AdminUI.tsx` | YES |
| Subscriptions | Wide cards, weak grouping | Ops need payment + driver assignment status | KPI row, filters, cards, assignment drawer | `SubscriptionsSection.tsx`, `AdminUI.tsx` | YES |
| Trips | Duplicate KPI sections, rough kanban | Command center needs single ops surface | Unified board + list toggle, generate bar, mobile column tabs | `TripsSection.tsx`, `TripOperationsBoard.tsx` | YES |
| Financials | Misaligned KPIs, inconsistent currency | Finance requires precise readable amounts | `formatSar` everywhere, metric grid, responsive payment table/cards | `FinancialsSection.tsx`, `adminCurrency.ts` | YES |
| Safety Reports | Plain cards, weak severity | Safety needs calm but urgent hierarchy | Severity KPIs, warning badges, review drawer | `SafetySection.tsx`, `AdminUI.tsx` | YES |
| System Config | One long unstructured form | Settings hard to find and validate | Grouped tabs (pricing, trips, tracking, etc.), sticky save bar | `SystemConfigSection.tsx`, `systemConfigGroups.ts` | YES |
| Audit Logs | Raw JSON in rows | Unacceptable for production compliance UI | Human-readable summaries, severity badges, collapsed JSON in drawer | `AuditLogsSection.tsx`, `adminAudit.ts` | YES |

## Mobile admin

- `AdminShell.tsx`: mobile top app bar, slide-out nav drawer, bottom quick nav
- Tables fall back to cards via `AdminTable` mobile mode
- Drawers full-width on mobile; touch targets >= 44px
- Trip kanban uses tabs on mobile instead of 4 columns

## Design system (`AdminUI.tsx`)

Components in active use across all sections:

1. `AdminSectionHeader` — all sections
2. `AdminToolbar` — users, riders, drivers, financials, safety, audit, packages, subscriptions, trips
3. `AdminMetricGrid` — all sections except audit (partial)
4. `AdminDataCard` — riders, drivers, applications, packages, subscriptions, safety, audit
5. `AdminTable` — users, financials
6. `AdminDrawer` — users, riders, drivers, applications, subscriptions, safety, audit
7. `AdminStatusBadge` — all entity sections
8. `AdminEmptyState` — all list sections
9. `AdminJsonDetails` — audit drawer only (collapsed by default)
10. Mobile shell — `AdminShell.tsx` (top bar + bottom nav + drawer)

## Remaining limitations

- Rider/driver KPIs for special counts use current page data where API has no aggregate endpoint
- Chat moderation panel moved to trips board context only (no separate sysconfig keys)
- Overview section not redesigned in this task (out of scope list)
