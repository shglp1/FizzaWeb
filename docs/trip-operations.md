# Trip Operations — Production Runbook

## Roles & permissions

| Action | Parent | Driver | Admin |
|--------|--------|--------|-------|
| View own trips | ✅ | ✅ assigned | ✅ all |
| Live tracking | ✅ own, 10 min window | ✅ assigned | ✅ |
| Push GPS | ❌ | ✅ assigned + window | ✅ |
| Chat | ✅ window + not blocked | ✅ assigned + not blocked | ✅ monitor |
| Status advance | ❌ | ✅ lifecycle | ✅ override + reason |
| Reassign driver | ❌ | ❌ | ✅ reason required |

## Tracking privacy

- Parents see GPS only when `isParentLocationVisible()` — 10 minutes before pickup or active leg.
- Location POST rejected outside `isLocationSharingAllowed()`.
- Terminal trips stop location sharing; `LOCATION_SHARING_STOPPED` event recorded.

## Notifications

Triggered via `tripNotifications.ts` with **TripEvent deduplication** (one per `eventType` per trip).

| Trigger | Event | Notification |
|---------|-------|--------------|
| Driver assigned | DRIVER_ASSIGNED | Parent + driver |
| Location sharing | LOCATION_SHARING_STARTED | Parent |
| ETA ≤ 5 min to pickup | FIVE_MINUTES_TO_PICKUP | Parent |
| Near pickup (distance/ETA) | NEAR_PICKUP | Parent |
| Arrived pickup | ARRIVED_PICKUP | Parent |
| Rider picked up | RIDER_PICKED_UP | Parent |
| ETA ≤ 5 min to drop-off | FIVE_MINUTES_TO_DROPOFF | Parent |
| Near drop-off | NEAR_DROPOFF | Parent |
| Completed | COMPLETED | Parent |
| Driver late (cron) | DRIVER_LATE | Parent + admin |
| Rider late (driver) | RIDER_LATE | Parent + admin |

### ETA calculation

1. **OpenRouteService** directions duration when `OPENROUTESERVICE_API_KEY` is set.
2. **Fallback**: haversine distance ÷ `averageFallbackSpeedKmh` from SystemConfiguration.

Config keys (SystemConfiguration table):

- `etaNearThresholdMinutes` (default 5)
- `pickupNearThresholdMeters` (default 100)
- `dropoffNearThresholdMeters` (default 100)
- `averageFallbackSpeedKmh` (default 30)
- `driverLateAfterMinutes` (default 15)
- `notificationCooldownMinutes` (default 10)

## Chat

- Opens 20 minutes before scheduled pickup.
- Closes 30 minutes after completion/cancel/no-show.
- Moderation: CLEAN / FLAGGED / BLOCKED; blocked messages rejected at POST.
- Chat blocks via `ChatBlock` model; admin APIs under `/api/admin/chat/blocks`.
- Image upload: `POST /api/trips/[id]/chat/attachment` (local storage, jpeg/png/webp).

## Admin operations

- **Kanban board**: Admin → Trips (`TripOperationsBoard`)
- **Trip detail**: `GET /api/admin/trips/[id]`
- **Reassign**: `PATCH /api/admin/trips/[id]/reassign` (reason required)
- **Late detection cron**: `POST /api/admin/trips/check-late` every 1–5 minutes

### Vercel Cron example

```json
{
  "crons": [{
    "path": "/api/admin/trips/check-late",
    "schedule": "*/5 * * * *"
  }]
}
```

Requires admin session or extend with `CRON_SECRET` header (future hardening).

## Driver route sheet

- `GET /api/trips?from=&to=&page=&limit=&status=`
- Driver UI: Today, Tomorrow, Upcoming, Active, Completed, Cancelled + Load more

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENROUTESERVICE_API_KEY` | Route ETA |
| `STORAGE_DRIVER=local` | Chat image storage |
| `UPLOAD_MAX_SIZE_MB` | Max attachment size |
| `DATABASE_URL` | Prisma |

## Tests

- `src/tests/task12.smoke.ts` — lifecycle helpers
- `src/tests/task12_1.smoke.ts` — catalog, auth, ETA, late detection
