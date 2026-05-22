# Distance-Based Subscription Pricing

## Why users do not enter distance manually

Manually entered distances are unreliable — users may not know the exact route length, and inaccurate values lead to under- or over-charging. Fizza calculates real road distances automatically using a geocoding and routing API so the price is always accurate and consistent.

## How distance is calculated

When a user requests a subscription price quote, the server:

1. Geocodes the **pickup location** to coordinates using the OpenRouteService Geocoding Search API.
2. Geocodes the **drop-off location** to coordinates.
3. Calls the OpenRouteService Directions API (`driving-car` profile) to find the shortest road route.
4. Extracts the route distance from the response (`summary.distance`, in metres) and converts to kilometres.

All of this happens **server-side only**. The API key is never sent to the browser.

The distance is snapshotted on the subscription at creation time so future admin price changes do not retroactively alter existing subscription costs.

## ONE_WAY vs ROUND_TRIP

| Direction | Chargeable distance |
|-----------|---------------------|
| ONE_WAY   | oneWayDistanceKm × 1 |
| ROUND_TRIP | oneWayDistanceKm × 2 |

School and university subscriptions default to **ROUND_TRIP** because the vehicle travels both to school in the morning and back home in the afternoon.

## Pricing formula

```
chargeableDistanceKm  = oneWayDistanceKm × (2 if ROUND_TRIP else 1)
distanceChargeSar     = chargeableDistanceKm × pricePerKmSar
primaryFinalSar       = packagePriceSar + addOnsPriceSar + distanceChargeSar
extraRiderChargeSar   = numExtraRiders × (primaryFinalSar × extraRiderSameDropoffMultiplier)
finalPriceSar         = primaryFinalSar + extraRiderChargeSar
```

### Round-trip example

- Pickup → school road distance: **5 km**
- `tripDirection = ROUND_TRIP`
- `pricePerKmSar = 10`
- `chargeableDistanceKm = 5 × 2 = 10 km`
- `distanceChargeSar = 10 × 10 = SAR 100`

### Extra rider example (continuing from above)

- `packagePriceSar = 300`, `addOnsPriceSar = 0`, `distanceChargeSar = 100`
- `primaryFinalSar = 400`
- 1 extra rider, `extraRiderSameDropoffMultiplier = 0.5`
- `extraRiderChargeSar = 1 × 400 × 0.5 = SAR 200`
- `finalPriceSar = 400 + 200 = SAR 600`

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENROUTESERVICE_API_KEY` | Yes | Server-side routing & geocoding (never exposed to client) |
| `DISTANCE_PROVIDER` | No (defaults to `OPENROUTESERVICE`) | Selects the active routing provider |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | No | Client-side map tile display only — unrelated to pricing |

## Admin configuration

Admins can update the following values in the **System Configuration** section of the admin dashboard:

| Key | Default | Description |
|-----|---------|-------------|
| `pricePerKmSar` | 2.0 | SAR charged per chargeable kilometre |
| `extraRiderSameDropoffMultiplier` | 0.5 | Fraction of primary price added per extra rider |

Changes take effect for **new subscriptions** only. Existing subscriptions retain the price snapshot recorded at creation time.

## Trip generation and legs

For **ROUND_TRIP** subscriptions, two trips are generated per rider per active weekday:

| Leg | Pickup | Drop-off | Time |
|-----|--------|----------|------|
| OUTBOUND | pickupLocation | dropoffLocation | pickupTime |
| RETURN | dropoffLocation | pickupLocation | returnTime |

For **ONE_WAY** subscriptions, only the **OUTBOUND** leg is generated.

Duplicate prevention: before creating a trip the system checks for an existing trip with the same `(subscriptionId, riderId, scheduledDate, legType)` combination.

## Limitations

- OpenRouteService free tier has rate limits (2,000 requests/day on the free plan). High-volume production environments may need a paid plan or alternative provider.
- Route accuracy depends on OpenStreetMap data quality in the service area.
- Unusual addresses may fail geocoding — users receive a clear error message asking them to enter a more specific address.
- Production deployments may switch to **Google Maps** or **Mapbox** for better coverage and SLA. The architecture supports adding providers by implementing the same interface in `src/lib/maps/distance.ts`.
