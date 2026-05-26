/** Client-safe map tile configuration (no secrets). */

export type MapTileLayerId = 'standard' | 'detailed';

export type MapTileConfig = {
  id: MapTileLayerId;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  minZoom: number;
};

const STANDARD_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim() ||
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

const STANDARD_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION?.trim() ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const DETAILED_URL = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
const DETAILED_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
  'Tiles style by <a href="https://www.hotosm.org/" target="_blank" rel="noopener">Humanitarian OpenStreetMap Team</a>';

export const MAP_TILE_LAYERS: Record<MapTileLayerId, MapTileConfig> = {
  standard: {
    id: 'standard',
    label: 'Standard',
    url: STANDARD_URL,
    attribution: STANDARD_ATTRIBUTION,
    minZoom: 5,
    maxZoom: 19,
  },
  detailed: {
    id: 'detailed',
    label: 'Detailed',
    url: DETAILED_URL,
    attribution: DETAILED_ATTRIBUTION,
    minZoom: 5,
    maxZoom: 19,
  },
};

export const DEFAULT_MAP_ZOOM = {
  country: 6,
  city: 12,
  place: 16,
  street: 17,
} as const;

/** Tile host patterns referenced in CSP tests. */
export const MAP_TILE_CSP_HOSTS = [
  'https://*.tile.openstreetmap.org',
  'https://tile.openstreetmap.org',
  'https://a.tile.openstreetmap.org',
  'https://b.tile.openstreetmap.org',
  'https://c.tile.openstreetmap.org',
  'https://*.openstreetmap.org',
  'https://*.tile.openstreetmap.fr',
  'https://a.tile.openstreetmap.fr',
  'https://b.tile.openstreetmap.fr',
  'https://c.tile.openstreetmap.fr',
];

export function getMapTileLayer(id: MapTileLayerId): MapTileConfig {
  return MAP_TILE_LAYERS[id] ?? MAP_TILE_LAYERS.standard;
}
