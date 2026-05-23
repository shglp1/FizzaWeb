# UI/UX Review — Task 10: Enterprise UI/UX Upgrade

## Design System Foundation

### Tailwind Configuration (`tailwind.config.ts`)
| Token | Value | Purpose |
|---|---|---|
| `fizza-primary` | `#0B683A` | Brand green (buttons, links, accents) |
| `fizza-secondary` | `#14A34A` | Lighter brand green (badges, active states) |
| `fizza-soft` | `#C3E759` | Lime accent (hero gradients) |
| `fizza-muted` | `#F0F7E9` | Tinted backgrounds |
| `shadow-card` | `0 1px 3px …` | Subtle card shadow |
| `shadow-card-md` | `0 4px 12px …` | Elevated card shadow |
| `shadow-glow` | `0 0 20px … rgba(20,163,74,…)` | Brand-coloured glow |
| `animation-fade-in` | 200 ms ease-out | Page transitions |
| `animation-slide-up` | 300 ms ease-out | Form reveal |

### Component Library (`src/components/ui/index.tsx`)

| Component | Variants | Notes |
|---|---|---|
| `Button` | `primary`, `outline`, `ghost`, `danger`, `danger-outline` | `loading` prop shows spinner |
| `Badge` | `success`, `danger`, `warning`, `info`, `purple`, `orange`, `gray` | Small inline label |
| `StatusBadge` | Same as Badge + `default` | Pill shape, used for entity statuses |
| `Input` | — | `forwardRef`, label, error, helpText |
| `Textarea` | — | `forwardRef`, same props as Input |
| `Select` | — | `forwardRef`, same props |
| `Card` | `padding="md"` (default) / `"sm"` / `"none"` | Rounded-2xl, white, shadow-card |
| `Alert` | `success`, `error`, `warning`, `info` | Dismissible with `onClose` |
| `StatCard` | — | KPI card with icon, value, label |
| `EmptyState` | — | icon + title + description + optional CTA |
| `LoadingState` | — | Spinner + message |
| `ErrorState` | — | Error message + Retry button |
| `PageHeader` | — | title, subtitle, optional `action` slot |
| `ConfirmDialog` | — | Modal with confirm/cancel, `confirmVariant` |
| `Tabs` | — | `onChange` callback, scrollable |
| `Pagination` | — | Prev/Next + page indicator |

### Global CSS (`src/styles/globals.css`)
Utility classes via `@layer components`:
- `.card` — white rounded-2xl card with border
- `.btn`, `.btn-primary`, `.btn-outline`, `.btn-ghost`, `.btn-danger`, `.btn-danger-outline`
- `.input`, `.label`, `.field`
- `.badge`, `.badge-success`, `.badge-danger`, `.badge-warning`, `.badge-info`
- `.stat-card`, `.empty-state`, `.skeleton`
- `.tab-bar`, `.tab-btn`, `.tab-btn-active`

---

## Layout System

### Logo (`src/components/layout/Logo.tsx`)
- Custom SVG "F" mark on gradient background
- `light` / `dark` theme prop
- `iconOnly` prop for collapsed sidebar
- Links to `/`

### Sidebar (`src/components/layout/Sidebar.tsx`)
- Sticky, scrollable, `min-h-screen`
- Role-aware: Admin link only visible to users with `role === 'admin'`
- Active-link dot indicator
- JWT decoded client-side from `fizza-session` cookie (base64 only — not signature-verified; used for display only)
- Logout via `POST /api/auth/logout`

### MobileNav (`src/components/layout/MobileNav.tsx`)
- Fixed bottom bar with 5 primary destinations
- `aria-selected` on active tab
- 76 px height, safe-area-aware padding

### AppShell (`src/components/layout/AppShell.tsx`)
- `MobileTopBar`: sticky brand bar on mobile with notification icon
- Desktop: sidebar + main content with `max-w-6xl` container
- `pb-24 md:pb-6` to clear mobile nav

---

## Page Inventory

| Page | Route | Key Features |
|---|---|---|
| Landing | `/` | Hero, feature grid, CTA, footer |
| Login | `/login` | Email + password, `react-hook-form`, error Alert |
| Register | `/register` | Full name, email, optional phone, password confirm |
| Reset Password | `/reset-password` | Two-state (form → success) |
| Dashboard | `/dashboard` | 4 StatCards, recent trips, quick actions, riders list |
| Profile | `/profile` | Gradient avatar, edit form, driver CTA/approved card |
| Riders | `/riders` | Card grid, add/edit modals, ConfirmDialog for deactivate |
| Subscriptions | `/subscriptions` | SubCard, pay-with-wallet / pay-online, ConfirmDialog cancel |
| New Subscription | `/subscriptions/new` | 4-step Stepper wizard (Package → Schedule → Route → Review) |
| Wallet | `/wallet` | Gradient hero balance, StatCards, quick top-up, tx history |
| Trips | `/trips` | Tabs filter, trip cards, ConfirmDialog cancel, DriverGpsPanel |
| Tracking | `/tracking/[tripId]` | Live map fallback, status timeline, 20 s poll |
| Safety | `/safety` | Category picker, report cards, inline edit for pending |
| Notifications | `/notifications` | Relative timestamps, mark-read, unread filter |
| Driver Application | `/driver-application` | StatusTracker, vehicle type grid, resubmit flow |
| Admin | `/admin` | 11-section tab dashboard (all CRUD operations) |

---

## Role-Based UX

| Role | Key Differentiators |
|---|---|
| `PARENT` | Can create subscriptions, manage riders, view trips, top up wallet |
| `DRIVER` | GPS panel visible on active trips; "Driver mode" alert in Trips |
| `ADMIN` | Admin link in sidebar; full `/admin` dashboard access |

Role is decoded client-side from the JWT payload for display only. All route protection and data access is enforced server-side via API middleware.

---

## Accessibility Notes

- All interactive elements have `:focus-visible` rings (`ring-2 ring-fizza-secondary/40`)
- Icon-only buttons have `aria-label` or `title`
- SVG icons use `aria-hidden="true"` when decorative
- Tabs use `role="tab"` + `aria-selected`
- Form inputs use `<label>` elements (via `Input` component)
- `EmptyState`, `LoadingState`, `ErrorState` provide consistent non-data feedback

---

## Known Limitations

1. **Map component**: `/tracking/[tripId]` uses a static Mapbox image API for the map. An interactive Mapbox GL JS or Leaflet map would require additional bundle setup. Set `NEXT_PUBLIC_MAPBOX_TOKEN` to enable.

2. **Real-time updates**: Trip tracking polls every 20 seconds. A WebSocket or SSE integration would give true real-time updates.

3. **File uploads**: Driver application documents accept URL strings only. Direct file upload (S3/Cloudinary) would require a new API endpoint and signed-URL flow.

4. **CAPTCHA / bot protection**: No CAPTCHA on auth forms. Should be added for production.

5. **Pagination UX on admin sections**: The `Pagination` component does not deep-link (URL query params). Browser back does not restore the previous page. Acceptable for an admin panel; would need `useSearchParams` for user-facing lists.

6. **Skeleton loaders**: Some pages use `LoadingState` (spinner) rather than skeleton screens. Skeletons would reduce perceived load time.

7. **Toast notifications**: Inline `Alert` components are used for feedback. A global toast/snackbar system would allow non-blocking, auto-dismissing feedback.

8. **Mobile sidebar**: On small screens the sidebar is hidden; only the bottom MobileNav is shown. This means the full section list (11 admin sections) is not accessible from mobile without scrolling the horizontal Tabs. Acceptable for an admin-only audience primarily on desktop.
