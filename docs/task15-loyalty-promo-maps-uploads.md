# Task 15 — Loyalty, promo codes, maps, uploads

## Loyalty program

### Earning

- Points awarded on **subscription payment** (online or wallet) — not wallet top-ups.
- Config: `loyaltyPointsPerSar`, `loyaltyPointsOnSafetyApproval`.
- Safety report approval awards bonus points when configured.

### Redemption (checkout)

Admin settings (System Config → Loyalty / Payments):

| Key | Default | Meaning |
|-----|---------|---------|
| `loyaltyRedemptionEnabled` | `false` | Master switch |
| `loyaltyRedemptionPointsPerSar` | `10` | Points per SAR 1 discount |
| `loyaltyRedemptionMaxPercentOfOrder` | `20` | Max loyalty discount % of subtotal |
| `loyaltyMinimumPointsToRedeem` | `100` | Minimum redemption |

Parent flow (`/subscriptions/new` step 3):

- Shows available points and redemption explanation.
- Enter points or “Use maximum available”.
- Points deducted **only after successful payment** (idempotent per `paymentId`).
- Failed/cancelled payments do not deduct points.

### Discount order

1. Promo code percentage off subtotal.
2. Loyalty points off remaining amount (capped by max %).
3. Final price ≥ 0.

## Promo codes

- Admin-managed in Packages → Promo codes.
- Validated at quote and subscription create.
- Redemption recorded once on payment success (idempotent per payment).

## Distance / maps

Provider priority when `DISTANCE_PROVIDER=AUTO` (default):

1. **OpenRouteService** — if `OPENROUTESERVICE_API_KEY` is set (recommended for production).
2. **OSRM free demo** — `OSRM_BASE_URL` (default `https://router.project-osrm.org`), server-side only, rate-limited, no SLA.
3. **Haversine × road factor** — `DISTANCE_FALLBACK_ROAD_FACTOR` (default `1.35`).

Quote/subscription responses include:

- `distanceProvider` — e.g. `OPENROUTESERVICE`, `OSRM_FREE`, `HAVERSINE_ESTIMATE`
- `distanceApproximate` — `true` when haversine estimate used
- `distanceWarning` — shown to parents and admins when approximate

Geocoding: ORS when configured, else Nominatim (free OSM).

## File uploads

| Env | Behavior |
|-----|----------|
| `STORAGE_DRIVER=local` | Dev — `public/uploads/` |
| `STORAGE_DRIVER=r2` | Production — Cloudflare R2 |

See [storage-production.md](./storage-production.md) for R2 setup.

Categories: avatars, riders, safety, driver-documents, subscription-locations.

## Driver application documents

Required/recommended uploads on `/driver-application`:

- National ID / Iqama
- Driving license
- Vehicle registration
- Vehicle insurance (optional)
- Vehicle photo (recommended, images only)

Admin Driver Applications drawer shows document links/previews.

## Environment variables

See `.env.example` for `STORAGE_*`, `R2_*`, `DISTANCE_*`, `OSRM_BASE_URL`, and `OPENROUTESERVICE_API_KEY`.
