# Trip Lifecycle — Status Mapping

Internal database statuses are stable Prisma enum values. Business-facing labels use the **status catalog** (`src/lib/trips/statusCatalog.ts`).

## Internal → Display mapping

| Internal (DB) | Display status | UI label |
|---------------|----------------|----------|
| `SCHEDULED` | SCHEDULED | Scheduled |
| `DRIVER_ASSIGNED` | DRIVER_ASSIGNED | Driver Assigned |
| `PRE_TRIP` | PRE_TRIP_TRACKING | Pre-Trip Tracking |
| `ON_THE_WAY` | EN_ROUTE_TO_PICKUP | En Route to Pickup |
| *(derived via ETA/geofence)* | ARRIVING_PICKUP | Arriving at Pickup |
| `ARRIVED_PICKUP` | ARRIVED_PICKUP | Arrived at Pickup |
| `PICKED_UP` | RIDER_PICKED_UP | Rider Picked Up |
| `EN_ROUTE_DROPOFF` | EN_ROUTE_TO_DROPOFF | En Route to Drop-off |
| *(derived via ETA/geofence)* | ARRIVING_DROPOFF | Arriving at Drop-off |
| `ARRIVED_DROPOFF` | ARRIVED_DROPOFF | Arrived at Drop-off |
| `COMPLETED` | COMPLETED | Completed |
| `CANCELLED` | CANCELLED | Cancelled |
| `NO_SHOW` | NO_SHOW | No Show |

## Event-only statuses (not TripStatus enum)

| Event type | Meaning |
|------------|---------|
| `DRIVER_LATE` | Pickup time passed without arrival |
| `RIDER_LATE` | Driver at pickup, rider not ready |
| `FIVE_MINUTES_TO_PICKUP` | ETA ≤ threshold before pickup |
| `FIVE_MINUTES_TO_DROPOFF` | ETA ≤ threshold before drop-off |

## Why not rename the enum?

Migrating 11+ production statuses mid-release risks breaking existing trips, reports, and admin filters. The catalog layer gives spec-aligned UX without a destructive migration.

## API usage

- UI: `getDisplayLabel(internalStatus, { nearPickup?, nearDropoff? })`
- Allowed actions: `getAllowedActions(status, role)`
- Timeline: `EVENT_DISPLAY_LABELS[eventType]`
