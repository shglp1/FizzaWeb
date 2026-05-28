'use client';

import { useEffect, useRef, useState } from 'react';
import { ensureLeafletCssBundled, TRACKING_MARKER_COLORS, trackingMarkerHtml } from '@/components/tracking/mapMarkerHelpers';
import { getMapTileLayer } from '@/lib/maps/mapTiles';

export type TripMapPoint = {
  driverLat?: number | null;
  driverLng?: number | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  stale?: boolean;
};

function toCoord(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * SSR-safe Leaflet map using DivIcon markers only — no default marker assets.
 */
export function TripTrackingMap({
  driverLat,
  driverLng,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  stale = false,
  pickupLabel = 'Pickup',
  dropoffLabel = 'Drop-off',
  driverLabel = 'Driver',
  className = '',
  height = 360,
  onReadyChange,
  routeGeometry,
  routeSource = 'approximate',
}: TripMapPoint & {
  pickupLabel?: string;
  dropoffLabel?: string;
  driverLabel?: string;
  className?: string;
  height?: number;
  onReadyChange?: (ready: boolean) => void;
  routeGeometry?: [number, number][];
  routeSource?: 'road' | 'approximate';
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const layersRef = useRef<{
    driver?: import('leaflet').Marker;
    pickup?: import('leaflet').Marker;
    dropoff?: import('leaflet').Marker;
    route?: import('leaflet').Polyline;
  }>({});
  const [tilesReady, setTilesReady] = useState(false);

  useEffect(() => {
    onReadyChange?.(tilesReady);
  }, [tilesReady, onReadyChange]);

  useEffect(() => {
    ensureLeafletCssBundled();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    setTilesReady(false);

    import('leaflet').then((L) => {
      if (cancelled || !mapRef.current) return;

      const dLat = toCoord(driverLat);
      const dLng = toCoord(driverLng);
      const pLat = toCoord(pickupLat);
      const pLng = toCoord(pickupLng);
      const doLat = toCoord(dropoffLat);
      const doLng = toCoord(dropoffLng);

      const points: [number, number][] = [];
      if (dLat != null && dLng != null) points.push([dLat, dLng]);
      if (pLat != null && pLng != null) points.push([pLat, pLng]);
      if (doLat != null && doLng != null) points.push([doLat, doLng]);

      if (points.length === 0) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current, {
          zoomControl: true,
          attributionControl: true,
        });
        mapInstanceRef.current = map;

        const tiles = getMapTileLayer('standard');
        L.tileLayer(tiles.url, {
          attribution: tiles.attribution,
          maxZoom: tiles.maxZoom,
          minZoom: tiles.minZoom,
        }).addTo(map).on('load', () => {
          if (!cancelled) setTilesReady(true);
        });
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      const upsertMarker = (
        key: 'driver' | 'pickup' | 'dropoff',
        lat: number,
        lng: number,
        html: string,
        label: string,
        size: number,
        ariaLabel: string,
      ) => {
        const icon = L.divIcon({
          html,
          className: 'fizza-map-marker',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const existing = layersRef.current[key];
        if (existing) {
          existing.setLatLng([lat, lng]);
          existing.setIcon(icon);
          existing.bindPopup(label);
        } else {
          layersRef.current[key] = L.marker([lat, lng], { icon, alt: ariaLabel, title: ariaLabel })
            .addTo(map)
            .bindPopup(label);
        }
      };

      if (dLat != null && dLng != null) {
        upsertMarker(
          'driver',
          dLat,
          dLng,
          trackingMarkerHtml(stale ? TRACKING_MARKER_COLORS.driverStale : TRACKING_MARKER_COLORS.driver, 18),
          driverLabel,
          18,
          stale ? `${driverLabel} (location may be outdated)` : driverLabel,
        );
      } else if (layersRef.current.driver) {
        map.removeLayer(layersRef.current.driver);
        delete layersRef.current.driver;
      }

      if (pLat != null && pLng != null) {
        upsertMarker(
          'pickup',
          pLat,
          pLng,
          trackingMarkerHtml(TRACKING_MARKER_COLORS.pickup, 16),
          pickupLabel,
          16,
          pickupLabel,
        );
      } else if (layersRef.current.pickup) {
        map.removeLayer(layersRef.current.pickup);
        delete layersRef.current.pickup;
      }

      if (doLat != null && doLng != null) {
        upsertMarker(
          'dropoff',
          doLat,
          doLng,
          trackingMarkerHtml(TRACKING_MARKER_COLORS.dropoff, 16),
          dropoffLabel,
          16,
          dropoffLabel,
        );
      } else if (layersRef.current.dropoff) {
        map.removeLayer(layersRef.current.dropoff);
        delete layersRef.current.dropoff;
      }

      const routePoints: [number, number][] =
        routeGeometry && routeGeometry.length >= 2
          ? routeGeometry
          : (() => {
              const pts: [number, number][] = [];
              if (pLat != null && pLng != null) pts.push([pLat, pLng]);
              if (doLat != null && doLng != null) pts.push([doLat, doLng]);
              return pts;
            })();

      const isApprox = routeSource === 'approximate' || !routeGeometry || routeGeometry.length < 2;

      if (routePoints.length >= 2) {
        const style = {
          color: TRACKING_MARKER_COLORS.route,
          weight: isApprox ? 3 : 5,
          opacity: isApprox ? 0.55 : 0.85,
          dashArray: isApprox ? '8 6' : undefined as string | undefined,
        };
        if (layersRef.current.route) {
          layersRef.current.route.setLatLngs(routePoints);
          layersRef.current.route.setStyle(style);
        } else {
          layersRef.current.route = L.polyline(routePoints, style).addTo(map);
        }
      } else if (layersRef.current.route) {
        map.removeLayer(layersRef.current.route);
        delete layersRef.current.route;
      }

      const boundsPoints = [...points];
      if (boundsPoints.length === 1) {
        map.setView(boundsPoints[0], 15);
      } else if (boundsPoints.length > 1) {
        map.fitBounds(boundsPoints, { padding: [40, 40], maxZoom: 16 });
      }

      requestAnimationFrame(() => {
        map.invalidateSize();
      });
      setTimeout(() => {
        map.invalidateSize();
        if (!cancelled) setTilesReady(true);
      }, 400);
    }).catch(() => { /* leaflet load failed */ });

    return () => { cancelled = true; };
  }, [driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng, stale, routeGeometry, routeSource, pickupLabel, dropoffLabel, driverLabel]);

  useEffect(() => () => {
    mapInstanceRef.current?.remove();
    mapInstanceRef.current = null;
    layersRef.current = {};
  }, []);

  return (
    <div
      ref={mapRef}
      className={`w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 ${className}`}
      style={{ height, minHeight: height, zIndex: 0 }}
      aria-label="Trip tracking map"
    />
  );
}
