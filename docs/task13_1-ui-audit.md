# Task 13.1 — Visual UX Audit & Redesign

| Page | Issue (before) | User pain | Redesign action | Files |
|------|----------------|-----------|-----------------|-------|
| `/subscriptions/new` | Single narrow column, 4 steps, price mixed with map | Confusing flow, no live summary | 5-step wizard, 2-col layout, sticky summary panel | `subscriptions/new/page.tsx`, `SubscriptionSummaryPanel.tsx` |
| `/dashboard` | Basic stat grid, flat trip list | Hard to see what matters today | Hero next-trip panel, attention list, enterprise cards | `dashboard/page.tsx`, `enterprise.tsx` |
| Admin trips board | JSON drawer, cramped kanban | Ops team can't act quickly | Structured drawer, color-coded columns, KPI grid | `TripOperationsBoard.tsx`, `TripDetailDrawer.tsx` |
| Map picker | Geolocation without guidance | Uncertainty after GPS | "Using your current location — move pin if needed" | `MapLocationPicker.tsx` |
| Driver trips | Functional but plain cards | Route sheet feel weak | (13 base) tabs + stats; 13.1 uses shared enterprise tokens | `driver/trips/page.tsx` |

## Components added (Task 13.1)

- `PageContainer`, `SectionHeader`, `EnterpriseCard`, `InfoRow`, `DataCard`
- `ActionBar`, `FormSection`, `StatsGrid`, `Timeline`, `HeroPanel`, `AttentionList`
- `SubscriptionSummaryPanel`, `TripDetailDrawer`

## Manual checklist

See PR description test plan.
