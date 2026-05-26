# Saudi Map Places Registry

## Why this exists

OpenStreetMap (OSM) tiles and public geocoders (Nominatim, OpenRouteService) are useful fallbacks, but they are **not sufficient alone** for production-grade Saudi pickup/drop-off search. Neighborhood names, schools, mosques, and landmarks are often missing, outdated, or inconsistent in OSM.

Fizza uses a **Saudi-first strategy**:

1. **Local Places Registry** (`MapPlace` table) — admin-managed, verified names and coordinates.
2. **Local-first geocode API** — search the registry before any external provider.
3. **External fallback** — ORS when configured, then Nominatim.
4. **Reverse geocode with local snap** — pin click/drag snaps to the nearest verified place within a configurable radius (default 250 m).
5. **Manual label editing** — parent can always override the label.

## OSM tile labels

Map **tile labels** depend entirely on what OSM contributors have mapped. We cannot force missing neighborhood or street names to appear on the basemap.

**Practical UX:**

- Search results and the selected-place card always show the chosen name (local or external).
- After selection, the map zooms to **17** (verified/local) or **16** (external).
- A **Detailed** tile layer (Humanitarian OSM / HOT) is available for richer labels where OSM has data.
- Gaps in tile labels are filled by the **Local Places Registry** for search and confirmation—not by editing tiles.

## Commercial maps (future)

For full commercial-grade basemaps and autocomplete, providers such as **Google Maps**, **Mapbox**, or **MapTiler** can be integrated later. The current free/enterprise approach is:

> OSM tiles + local registry + ORS/Nominatim fallback + manual label

## Admin workflow

- Navigate to **Admin → Map Places** (`/admin?section=map-places`).
- Add or edit places with Arabic/English names, aliases, type, city, coordinates, verified/active flags.
- No code deploy is required to improve search quality over time.

## API

- `GET /api/maps/geocode?q=…&lang=…` — local-first merged search.
- `GET /api/maps/reverse?lat=…&lng=…` — local snap, then ORS/Nominatim.
- `GET/POST /api/admin/map-places` — admin CRUD.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAP_LOCAL_PLACE_SNAP_RADIUS_METERS` | `250` | Max distance to snap pin to a local place on reverse geocode |

## Seed data (development)

`npx prisma db seed` creates sample Medina places when the table is empty:

- University of Prince Mugrin / جامعة الأمير مقرن
- Prophet Mosque / المسجد النبوي
- Al Aziziyah / حي العزيزية
- King Fahad Road
- Emaar Taibah Hotel

## Verified place overlay (Task 16.4)

When zoom ≥ 14 in the subscription map picker, **verified registry places** appear as labeled markers inside the current map bounds. This reduces reliance on OSM tile labels.

- Toggle: **Show verified places** (default on)
- Click a label to select that place as pickup/drop-off
- API: `GET /api/maps/places?bbox=minLng,minLat,maxLng,maxLat`

## Scale & performance

- Local search uses **DB-level** `WHERE` + `LIMIT` on normalized name/alias columns
- Admin list is **paginated** (`page`, `limit`)
- External geocode/reverse results are **cached** (`MapGeocodeCache`) for 14 days by default

## Confidence & admin review

Geocode results include `confidenceLevel` (`HIGH` | `MEDIUM` | `LOW`) and `needsAdminReview`.

When parents confirm external or manual locations, the system creates **MapLocationReview** items. Admins can convert them into verified `MapPlace` entries from **Map Places → Unverified locations from subscriptions**.

## Diagnostics

- Admin: **System Config → Tracking → Maps & Location Diagnostics**
- Dev CLI: `npm run check:maps`
- API: `GET /api/admin/maps/diagnostics`

## Provider architecture

`MAP_SEARCH_PROVIDER=AUTO` resolves: local registry → ORS (if key) → Nominatim.

Future providers (Google, Mapbox, MapTiler, HERE) are documented in `src/lib/maps/providers/types.ts` without SDK integration yet.
