'use client';

import { useEffect, useRef } from 'react';
import { buildDivIconHtml } from '@/lib/location/stableMapPickerHelpers';
import { getMapTileLayer, type MapTileLayerId } from '@/lib/maps/mapTiles';

type StableMapInnerMapProps = {
  lat: number;
  lng: number;
  markerColor: string;
  active: boolean;
  zoom: number;
  tileLayerId: MapTileLayerId;
  onMove: (lat: number, lng: number) => void;
};

export default function StableMapInnerMap({
  lat,
  lng,
  markerColor,
  active,
  zoom,
  tileLayerId,
  onMove,
}: StableMapInnerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null);
  const onMoveRef = useRef(onMove);
  const tileLayerIdRef = useRef(tileLayerId);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    tileLayerIdRef.current = tileLayerId;
  }, [tileLayerId]);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    let cancelled = false;

    void import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        tileLayerRef.current = null;
      }

      const tileConfig = getMapTileLayer(tileLayerIdRef.current);
      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom,
        minZoom: tileConfig.minZoom,
        maxZoom: tileConfig.maxZoom,
        zoomControl: true,
        attributionControl: true,
      });

      tileLayerRef.current = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom,
        minZoom: tileConfig.minZoom,
      }).addTo(map);

      const icon = L.divIcon({
        html: buildDivIconHtml(markerColor),
        className: 'fizza-map-marker',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const marker = L.marker([lat, lng], { draggable: true, icon, autoPan: true }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onMoveRef.current(pos.lat, pos.lng);
      });

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onMoveRef.current(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;

      const invalidate = () => map.invalidateSize({ animate: false });
      invalidate();
      requestAnimationFrame(invalidate);
      [100, 250, 500].forEach((ms) => setTimeout(invalidate, ms));
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        tileLayerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    const currentZoom = mapRef.current.getZoom();
    mapRef.current.setView([lat, lng], currentZoom, { animate: false });
  }, [lat, lng]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(zoom, { animate: false });
  }, [zoom]);

  useEffect(() => {
    if (!mapRef.current) return;

    void import('leaflet').then((L) => {
      if (!mapRef.current) return;
      const tileConfig = getMapTileLayer(tileLayerId);
      if (tileLayerRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
      }
      tileLayerRef.current = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom,
        minZoom: tileConfig.minZoom,
      }).addTo(mapRef.current);
    });
  }, [tileLayerId]);

  useEffect(() => {
    if (!active || !mapRef.current) return;
    const invalidate = () => mapRef.current?.invalidateSize({ animate: false });
    invalidate();
    const t = setTimeout(invalidate, 150);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="stable-map-canvas w-full rounded-xl overflow-hidden bg-gray-100"
      aria-hidden={!active}
    />
  );
}
