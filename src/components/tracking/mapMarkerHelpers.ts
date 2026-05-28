/** Leaflet DivIcon marker helpers for trip tracking maps. */

export const TRACKING_MARKER_COLORS = {
  driver: '#2563EB',
  driverStale: '#9CA3AF',
  pickup: '#10B981',
  dropoff: '#EF4444',
  route: '#0B683A',
} as const;

export function trackingMarkerHtml(color: string, size: number): string {
  return `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`;
}

export function ensureLeafletCssBundled(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('#leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}
