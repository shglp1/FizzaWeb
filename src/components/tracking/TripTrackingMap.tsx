'use client';

import { useEffect, useRef } from 'react';

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

function markerHtml(color: string, size: number): string {
  return `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`;
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
  className = '',
  height = 360,
}: TripMapPoint & { className?: string; height?: number }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);
  const layersRef = useRef<{
    driver?: import('leaflet').Marker;
    pickup?: import('leaflet').Marker;
    dropoff?: import('leaflet').Marker;
    route?: import('leaflet').Polyline;
  }>({});

  useEffect(() => {
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

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

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);
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
        } else {
          layersRef.current[key] = L.marker([lat, lng], { icon }).addTo(map).bindPopup(label);
        }
      };

      if (dLat != null && dLng != null) {
        upsertMarker(
          'driver',
          dLat,
          dLng,
          markerHtml(stale ? '#9CA3AF' : '#2563EB', 18),
          'Driver',
          18,
        );
      } else if (layersRef.current.driver) {
        map.removeLayer(layersRef.current.driver);
        delete layersRef.current.driver;
      }

      if (pLat != null && pLng != null) {
        upsertMarker('pickup', pLat, pLng, markerHtml('#10B981', 16), 'Pickup', 16);
      } else if (layersRef.current.pickup) {
        map.removeLayer(layersRef.current.pickup);
        delete layersRef.current.pickup;
      }

      if (doLat != null && doLng != null) {
        upsertMarker('dropoff', doLat, doLng, markerHtml('#EF4444', 16), 'Drop-off', 16);
      } else if (layersRef.current.dropoff) {
        map.removeLayer(layersRef.current.dropoff);
        delete layersRef.current.dropoff;
      }

      const routePoints: [number, number][] = [];
      if (pLat != null && pLng != null) routePoints.push([pLat, pLng]);
      if (doLat != null && doLng != null) routePoints.push([doLat, doLng]);

      if (routePoints.length >= 2) {
        if (layersRef.current.route) {
          layersRef.current.route.setLatLngs(routePoints);
        } else {
          layersRef.current.route = L.polyline(routePoints, {
            color: '#0B683A',
            weight: 4,
            opacity: 0.7,
            dashArray: '8 6',
          }).addTo(map);
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
      setTimeout(() => map.invalidateSize(), 200);
    }).catch(() => { /* leaflet load failed */ });

    return () => { cancelled = true; };
  }, [driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng, stale]);

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
