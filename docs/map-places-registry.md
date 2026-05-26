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

## Result badges (parent UI)

| Badge | Meaning |
|-------|---------|
| **Verified** | Admin-verified local registry entry |
| **Local** | Local registry entry (not yet verified) |
| **ORS** | OpenRouteService geocoder |
| **OSM** | OpenStreetMap / Nominatim |
