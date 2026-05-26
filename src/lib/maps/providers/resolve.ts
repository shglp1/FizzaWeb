/** Resolve map search/route providers from env — AUTO prefers local then ORS/OSRM. */

import type { MapProviderMode, MapRouteProviderId, MapSearchProviderId } from './types.ts';

export function getMapSearchProviderMode(): MapProviderMode {
  const raw = process.env.MAP_SEARCH_PROVIDER?.trim().toUpperCase();
  if (!raw || raw === 'AUTO') return 'AUTO';
  const allowed: MapSearchProviderId[] = ['local', 'ors', 'nominatim'];
  return allowed.includes(raw.toLowerCase() as MapSearchProviderId)
    ? (raw.toLowerCase() as MapSearchProviderId)
    : 'AUTO';
}

export function getMapRouteProviderMode(): MapProviderMode | MapRouteProviderId {
  const raw = process.env.MAP_ROUTE_PROVIDER?.trim().toUpperCase();
  if (!raw || raw === 'AUTO') return 'AUTO';
  const allowed: MapRouteProviderId[] = ['ors', 'osrm'];
  return allowed.includes(raw.toLowerCase() as MapRouteProviderId)
    ? (raw.toLowerCase() as MapRouteProviderId)
    : 'AUTO';
}

/** AUTO search order: local registry first, then ORS, then Nominatim. */
export function resolveAutoSearchProviderOrder(): MapSearchProviderId[] {
  const mode = getMapSearchProviderMode();
  if (mode !== 'AUTO') return [mode];
  const order: MapSearchProviderId[] = ['local'];
  if (process.env.OPENROUTESERVICE_API_KEY?.trim()) order.push('ors');
  order.push('nominatim');
  return order;
}
