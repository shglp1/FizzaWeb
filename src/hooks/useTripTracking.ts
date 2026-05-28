import { useCallback, useEffect, useRef, useState } from 'react';
import { mapsService } from '@/services/mapsService';
import { trackingService } from '@/services/trackingService';
import { toCoord } from '@/lib/parent/parentTrackingFormatters';
import { applyLocationPollUpdate } from '@/lib/tracking/locationPollState';
import { isTerminalTripStatus } from '@/lib/tracking/trackingVisibility';
import type { DriverLocationSnapshot, LiveEtaInfo, TrackingTrip } from '@/lib/tracking/trackingTypes';

function normalizeLocation(raw: unknown): DriverLocationSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const loc = raw as Record<string, unknown>;
  const lat = toCoord(loc.lat);
  const lng = toCoord(loc.lng);
  if (lat == null || lng == null) return null;
  return {
    lat,
    lng,
    recordedAt: String(loc.recordedAt ?? new Date().toISOString()),
    stale: Boolean(loc.stale),
  };
}

export type UseTripTrackingResult = {
  trip: TrackingTrip | null;
  location: DriverLocationSnapshot | null;
  liveEta: LiveEtaInfo | null;
  tooEarly: boolean;
  loading: boolean;
  pageError: string;
  routeGeometry: [number, number][] | undefined;
  routeSource: 'road' | 'approximate';
  routeLoading: boolean;
  mapLoading: boolean;
  setMapLoading: (v: boolean) => void;
  lastUpdatedLabel: string | null;
  refresh: () => Promise<void>;
};

export function useTripTracking(tripId: string, pollIntervalMs = 15_000): UseTripTrackingResult {
  const [trip, setTrip] = useState<TrackingTrip | null>(null);
  const [location, setLocation] = useState<DriverLocationSnapshot | null>(null);
  const [liveEta, setLiveEta] = useState<LiveEtaInfo | null>(null);
  const [tooEarly, setTooEarly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [routeGeometry, setRouteGeometry] = useState<[number, number][] | undefined>();
  const [routeSource, setRouteSource] = useState<'road' | 'approximate'>('approximate');
  const [routeLoading, setRouteLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripRef = useRef<TrackingTrip | null>(null);

  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);

  const fetchTracking = useCallback(async () => {
    const res = await trackingService.get(tripId);
    if (res.data) {
      setTrip(res.data.trip as TrackingTrip);
      setLocation(normalizeLocation(res.data.location));
      setLiveEta(res.data.liveEta ?? null);
      setTooEarly(Boolean(res.data.tooEarly));
      setPageError('');
    } else {
      setPageError(res.error?.message ?? 'Failed to load tracking data.');
    }
    setLoading(false);
  }, [tripId]);

  const pollLocation = useCallback(async () => {
    const res = await trackingService.getLocation(tripId);
    if (!res.data) return;

    const update = applyLocationPollUpdate(tripRef.current, res.data);
    if (update.trip) setTrip(update.trip);
    setLocation(update.location);
    setTooEarly(update.tooEarly);
    if (update.liveEta !== undefined) {
      setLiveEta(update.liveEta);
    }

    if (update.stopPolling && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [tripId]);

  useEffect(() => {
    void fetchTracking();
  }, [fetchTracking]);

  useEffect(() => {
    if (!trip) return;
    const pLat = toCoord(trip.pickupLat);
    const pLng = toCoord(trip.pickupLng);
    const dLat = toCoord(trip.dropoffLat);
    const dLng = toCoord(trip.dropoffLng);
    if (pLat == null || pLng == null || dLat == null || dLng == null) return;

    let cancelled = false;
    setRouteLoading(true);
    mapsService
      .getRouteGeometry({ pickupLat: pLat, pickupLng: pLng, dropoffLat: dLat, dropoffLng: dLng })
      .then((res) => {
        if (cancelled || !res.data) return;
        setRouteGeometry(res.data.coordinates);
        setRouteSource(res.data.source);
      })
      .finally(() => {
        if (!cancelled) setRouteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trip]);

  useEffect(() => {
    if (!trip) return;
    if (isTerminalTripStatus(trip.status)) return;

    void pollLocation();
    pollRef.current = setInterval(pollLocation, pollIntervalMs);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [trip, pollLocation, pollIntervalMs]);

  const lastUpdatedLabel = location?.recordedAt ?? null;

  return {
    trip,
    location,
    liveEta,
    tooEarly,
    loading,
    pageError,
    routeGeometry,
    routeSource,
    routeLoading,
    mapLoading,
    setMapLoading,
    lastUpdatedLabel,
    refresh: fetchTracking,
  };
}
