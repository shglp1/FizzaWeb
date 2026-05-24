# Task 13.4.2 — Driver Portal Production Gaps

Branch: `task/13.4-driver-portal-redesign`  
Rebased onto `origin/main` before work.

## Limitations closed

| # | Limitation | Resolution |
|---|------------|------------|
| 1 | Chat / More placeholders | `TripChatDrawer` wired to existing chat API; `DriverTripMoreMenu` with real actions |
| 2 | This Week client-only filter | `buildDriverTripsListParams` sends `from`/`to` to API; no redundant client filter |
| 3 | GPS permission UX | Enhanced `DriverGpsPanel` state machine + `DriverGpsPermissionCard` copy |
| 4 | Straight-line map only | `GET /api/maps/route` + ORS geometry; dashed fallback with label |
| 5 | Activity log removed | `DriverTripActivityPanel` collapsible on tracking detail |

## Remaining limitations

- Support phone in More menu requires public config API (not yet exposed)
- ORS road route requires `OPENROUTESERVICE_API_KEY` configured
- Chat has polling (5s), no WebSocket
- GPS permission still ultimately browser-controlled (UX improved)
