import 'server-only';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getGeocodeCacheStats } from './geocodeCache.ts';
import { getMapPlaceCounts } from './localPlaceSearch.ts';
import { getMapSearchProviderMode, getMapRouteProviderMode } from './providers/resolve.ts';
import { MAP_TILE_CSP_HOSTS } from './mapTiles.ts';

function isOrsConfigured(): boolean {
  return !!process.env.OPENROUTESERVICE_API_KEY?.trim();
}

const ROOT = join(process.cwd());

async function pingUrl(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
    });
    return res.ok || res.status === 400;
  } catch {
    return false;
  }
}

export type MapDiagnosticsResult = {
  timestamp: string;
  osmTileCspConfigured: boolean;
  osmTileHosts: string[];
  orsConfigured: boolean;
  osrmReachable: boolean;
  nominatimReachable: boolean;
  mapSearchProvider: string;
  mapRouteProvider: string;
  mapPlaces: { total: number; verified: number; inactive: number; cities: number };
  geocodeCache: { total: number; active: number; expired: number };
  storageDriver: string;
  seedPlacesPresent: boolean;
};

export async function runMapDiagnostics(): Promise<MapDiagnosticsResult> {
  const configSrc = readFileSync(join(ROOT, 'next.config.ts'), 'utf8');
  const osmTileCspConfigured = MAP_TILE_CSP_HOSTS.every((host) => {
    const fragment = host.replace('https://', '').replace(/\./g, '\\.').replace(/\*/g, '.*');
    return new RegExp(fragment).test(configSrc);
  });

  const osrmBase = process.env.OSRM_BASE_URL?.trim() || 'https://router.project-osrm.org';
  const [osrmReachable, nominatimReachable, mapPlaces, geocodeCache] = await Promise.all([
    pingUrl(`${osrmBase.replace(/\/$/, '')}/route/v1/driving/46.6753,24.7136;46.6853,24.7236?overview=false`),
    pingUrl('https://nominatim.openstreetmap.org/search?q=Riyadh&format=json&limit=1', 8000),
    getMapPlaceCounts(),
    getGeocodeCacheStats(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    osmTileCspConfigured,
    osmTileHosts: MAP_TILE_CSP_HOSTS,
    orsConfigured: isOrsConfigured(),
    osrmReachable,
    nominatimReachable,
    mapSearchProvider: getMapSearchProviderMode(),
    mapRouteProvider: String(getMapRouteProviderMode()),
    mapPlaces,
    geocodeCache,
    storageDriver: process.env.STORAGE_DRIVER?.trim() || 'local',
    seedPlacesPresent: mapPlaces.verified >= 1,
  };
}
