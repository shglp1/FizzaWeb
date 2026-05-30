'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import {
  buildDivIconHtml,
  buildOverlayLabelIconHtml,
  MAP_OVERLAY_MIN_ZOOM,
} from '@/lib/location/stableMapPickerHelpers';
import { getMapTileLayer, type MapTileLayerId } from '@/lib/maps/mapTiles';

type OverlayPlace = {
  id: string;
  label: string;
  type: string;
  latitude: number;
  longitude: number;
};

type StableMapInnerMapProps = {
  lat: number;
  lng: number;
  markerColor: string;
  active: boolean;
  zoom: number;
  tileLayerId: MapTileLayerId;
  showVerifiedPlaces?: boolean;
  overlayLanguage?: 'ar' | 'en';
  onMove: (lat: number, lng: number) => void;
  onSelectOverlayPlace?: (place: OverlayPlace) => void;
};

export default function StableMapInnerMap({
  lat,
  lng,
  markerColor,
  active,
  zoom,
  tileLayerId,
  showVerifiedPlaces = true,
  overlayLanguage = 'en',
  onMove,
  onSelectOverlayPlace,
}: StableMapInnerMapProps) {
  const [tileError, setTileError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null);
  const overlayLayerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const onMoveRef = useRef(onMove);
  const onSelectOverlayRef = useRef(onSelectOverlayPlace);
  const showOverlayRef = useRef(showVerifiedPlaces);
  const overlayLangRef = useRef(overlayLanguage);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    onSelectOverlayRef.current = onSelectOverlayPlace;
  }, [onSelectOverlayPlace]);

  useEffect(() => {
    showOverlayRef.current = showVerifiedPlaces;
  }, [showVerifiedPlaces]);

  useEffect(() => {
    overlayLangRef.current = overlayLanguage;
  }, [overlayLanguage]);

  const refreshOverlay = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !showOverlayRef.current) {
      overlayLayerRef.current?.clearLayers();
      return;
    }

    const currentZoom = map.getZoom();
    if (currentZoom < MAP_OVERLAY_MIN_ZOOM) {
      overlayLayerRef.current?.clearLayers();
      return;
    }

    const bounds = map.getBounds();
    const minLng = bounds.getWest();
    const minLat = bounds.getSouth();
    const maxLng = bounds.getEast();
    const maxLat = bounds.getNorth();
    const bbox = `${minLng},${minLat},${maxLng},${maxLat}`;

    try {
      const res = await fetch(
        `/api/maps/places?bbox=${encodeURIComponent(bbox)}&language=${overlayLangRef.current}`,
      );
      const json = (await res.json()) as { data?: OverlayPlace[] };
      const places = json.data ?? [];
      const L = await import('leaflet');
      if (!mapRef.current) return;

      overlayLayerRef.current?.clearLayers();
      const group = overlayLayerRef.current ?? L.layerGroup().addTo(mapRef.current);
      overlayLayerRef.current = group;

      for (const place of places) {
        const icon = L.divIcon({
          html: buildOverlayLabelIconHtml(place.label),
          className: 'fizza-map-place-label',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const m = L.marker([place.latitude, place.longitude], { icon, interactive: true });
        m.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectOverlayRef.current?.(place);
        });
        group.addLayer(m);
      }
    } catch {
      // overlay is optional — ignore fetch errors
    }
  }, []);

  const scheduleOverlayRefresh = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => void refreshOverlay(), 300);
  }, [refreshOverlay]);

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
        overlayLayerRef.current = null;
      }

      const tileConfig = getMapTileLayer(tileLayerId);
      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom,
        minZoom: tileConfig.minZoom,
        maxZoom: tileConfig.maxZoom,
        zoomControl: true,
        attributionControl: true,
      });

      const tileLayer = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom,
        minZoom: tileConfig.minZoom,
      }).addTo(map);

      // Track consecutive tile errors to surface a user-visible fallback banner.
      let errorCount = 0;
      tileLayer.on('tileerror', () => {
        errorCount += 1;
        if (errorCount >= 3) {
          setTileError(true);
        }
      });
      tileLayer.on('tileload', () => {
        errorCount = 0;
        setTileError(false);
      });

      tileLayerRef.current = tileLayer;

      overlayLayerRef.current = L.layerGroup().addTo(map);

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

      map.on('moveend', scheduleOverlayRefresh);
      map.on('zoomend', scheduleOverlayRefresh);

      mapRef.current = map;
      markerRef.current = marker;

      const invalidate = () => map.invalidateSize({ animate: false });
      invalidate();
      requestAnimationFrame(invalidate);
      [100, 250, 500].forEach((ms) => setTimeout(invalidate, ms));
      scheduleOverlayRefresh();
    });

    return () => {
      cancelled = true;
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        tileLayerRef.current = null;
        overlayLayerRef.current = null;
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
    scheduleOverlayRefresh();
  }, [zoom, scheduleOverlayRefresh]);

  useEffect(() => {
    if (!mapRef.current) return;

    setTileError(false);
    void import('leaflet').then((L) => {
      if (!mapRef.current) return;
      const tileConfig = getMapTileLayer(tileLayerId);
      if (tileLayerRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
      }
      const newTileLayer = L.tileLayer(tileConfig.url, {
        attribution: tileConfig.attribution,
        maxZoom: tileConfig.maxZoom,
        minZoom: tileConfig.minZoom,
      }).addTo(mapRef.current);

      let errorCount = 0;
      newTileLayer.on('tileerror', () => {
        errorCount += 1;
        if (errorCount >= 3) setTileError(true);
      });
      newTileLayer.on('tileload', () => {
        errorCount = 0;
        setTileError(false);
      });

      tileLayerRef.current = newTileLayer;
    });
  }, [tileLayerId]);

  useEffect(() => {
    scheduleOverlayRefresh();
  }, [showVerifiedPlaces, overlayLanguage, scheduleOverlayRefresh]);

  useEffect(() => {
    if (!active || !mapRef.current) return;
    const invalidate = () => mapRef.current?.invalidateSize({ animate: false });
    invalidate();
    const t = setTimeout(invalidate, 150);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="stable-map-canvas w-full rounded-xl overflow-hidden bg-gray-100"
        aria-hidden={!active}
      />
      {tileError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-gray-100/90 backdrop-blur-sm pointer-events-none z-[1000]">
          <MapPin className="w-8 h-8 text-gray-400" />
          <p className="text-sm font-medium text-gray-600 text-center px-4">
            Map tiles could not load.
            <br />
            Check your internet connection.
          </p>
        </div>
      )}
    </div>
  );
}
