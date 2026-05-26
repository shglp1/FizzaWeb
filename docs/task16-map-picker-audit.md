# Task 16 — Map picker audit (subscription flow)

## Files involved before replacement

| File | Role |
|------|------|
| `src/components/location/MapLocationPicker.tsx` | Broken picker used on `/subscriptions/new` step 2 |
| `src/components/location/LocationPicker.tsx` | Search-only picker (no map); not used on subscription wizard |
| `src/app/subscriptions/new/page.tsx` | Rendered **two** `MapLocationPicker` instances stacked |
| `src/styles/globals.css` | `.fizza-map-marker` DivIcon reset |
| `src/components/tracking/TripTrackingMap.tsx` | Tracking map (unchanged; already uses DivIcon) |

## Root causes of broken Step 3 (wizard index 2: Pickup & Drop-off)

### 1. Leaflet CSS loaded from CDN at runtime

`MapLocationPicker` injected `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` via a dynamic `<link>`. This is fragile in Next.js:

- Race with map init (tiles/markers render before CSS applies → blank/grey map).
- CDN CSS references default `marker-icon.png` paths relative to unpkg; combined with partial init this produced **broken marker image** requests in Network tab.

### 2. Two full map pickers open simultaneously

Step 2 rendered pickup **and** drop-off pickers in one scroll view. Each could enter “staging” with an active Leaflet map. Multiple maps in hidden/stacked layout caused:

- `invalidateSize()` only once at 100ms — insufficient when wizard step was just shown.
- Tile pane height collapse when parent flex layout recalculated.

### 3. Dropdown positioning bug

Search suggestions used `className="absolute z-50 …"` but the parent wrapper was **not** `position: relative` (only `space-y-1`). The dropdown could overlay the map footer and **block Confirm/Cancel clicks** (pointer-events on wrong layer).

### 4. Confirm/Cancel inside map card without z-index isolation

Footer buttons lived inside the same card as the map container without a raised footer layer. Leaflet panes (`z-index` 400+) could overlap sibling buttons in some browsers.

### 5. Map mounted while wizard step hidden

Wizard only renders the active step’s render function output, but switching steps unmounts/remounts maps. On return to step 2, maps re-init without reliable `invalidateSize` after layout settle.

### 6. Default marker PNG references

Although `MapPanel` used `L.divIcon`, Leaflet’s default icon CSS from CDN still loaded sprite rules. Any marker created without custom icon (or during failed init) triggered requests to `marker-icon.png` / `marker-shadow.png`.

## Replacement (Task 16)

| Item | New approach |
|------|----------------|
| Component | `StableMapPicker` + `StableMapInnerMap` |
| CSS | `import 'leaflet/dist/leaflet.css'` once in `globals.css` |
| Markers | `L.divIcon` only — green pickup, red drop-off, blue device location |
| Layout | One picker expanded at a time; confirmed compact cards |
| Buttons | Footer outside map shell, `z-index: 20`, `min-h-[44px]` |
| Map height | 320px mobile / 380px desktop via `.stable-map-canvas` |
| invalidateSize | On mount + 100/250/500ms + when `expanded` toggles |

## Files replaced for subscription flow

- `src/app/subscriptions/new/page.tsx` — uses `StableMapPicker` (sequential UX)
- `MapLocationPicker.tsx` — **not deleted** (legacy); subscription no longer imports it

## Unchanged (by design)

- `/api/maps/geocode` — server proxy, ORS/Nominatim, rate limit
- `/api/subscriptions/quote` — pricing logic unchanged
- `TripTrackingMap.tsx` — driver/parent tracking
