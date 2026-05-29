'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Radio, RefreshCw } from 'lucide-react';
import { Card, LoadingState, ErrorState, StatusBadge } from '@/components/ui';
import { formatVehicleDisplayLine } from '@/lib/vehicles/vehicleDisplay';

const TripTrackingMap = dynamic(
  () => import('@/components/tracking/TripTrackingMap').then((m) => m.TripTrackingMap),
  { ssr: false, loading: () => <div className="h-48 rounded-xl bg-gray-100 animate-pulse" /> },
);

type LiveTrip = {
  id: string;
  status: string;
  scheduledPickupTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  legType: string;
  gpsStale: boolean;
  gpsAgeSec: number | null;
  etaMinutes: number | null;
  rider: { name: string } | null;
  driver: { id: string; profile: { fullName: string; phone: string | null } | null } | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
  location: { lat: number; lng: number; recordedAt: string } | null;
  classification: { category: string; displayLabel: string; isStale: boolean };
};

type LiveData = {
  todayKey: string;
  refreshedAt: string;
  summary: {
    active: number;
    gpsStale: number;
    live: number;
    financialReviewPending: number;
    staleNonTerminal: number;
    lateOrMissed: number;
  };
  trips: LiveTrip[];
};

export function LiveOperationsSection() {
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/trips/live');
      const json = await res.json();
      if (json.data) setData(json.data);
      else setError(json.error?.message ?? 'Failed to load live operations');
    } catch {
      setError('Unable to connect');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <LoadingState message="Loading live operations…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const selectedTrip = data.trips.find((t) => t.id === selectedTripId) ?? null;
  const refreshedLabel = new Date(data.refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Live Operations</h2>
          <p className="text-sm text-gray-500">
            Riyadh business day {data.todayKey} · auto-refresh 30s · last updated {refreshedLabel}
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5 min-h-[44px]" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Refresh now
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active trips</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.active}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">GPS live</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{data.summary.live}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">GPS stale / unavailable</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{data.summary.gpsStale}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Financial review pending</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{data.summary.financialReviewPending}</p>
          <Link href="/admin?section=financial-review" className="text-xs text-fizza-primary mt-1 inline-block">Open financial review →</Link>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Stale (past dates)</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{data.summary.staleNonTerminal}</p>
          <Link href="/admin?section=trips" className="text-xs text-fizza-primary mt-1 inline-block">Review in Trip Operations →</Link>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Late / missed today</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{data.summary.lateOrMissed}</p>
        </Card>
      </div>

      {data.trips.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">No active trips on today&apos;s board.</Card>
      ) : (
        <div className="space-y-3">
          {data.trips.map((trip) => (
            <Card key={trip.id} className={`p-4 ${selectedTripId === trip.id ? 'ring-2 ring-fizza-primary/30' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{trip.rider?.name ?? 'Rider'}</p>
                    <StatusBadge variant={trip.gpsStale ? 'warning' : 'success'}>
                      {trip.gpsStale ? 'GPS stale' : 'GPS live'}
                    </StatusBadge>
                    <StatusBadge variant="info">{trip.classification.displayLabel}</StatusBadge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {trip.driver?.profile?.fullName ?? 'Unassigned'}
                    {trip.driver?.profile?.phone ? ` · ${trip.driver.profile.phone}` : ''}
                  </p>
                  {trip.vehicle && (
                    <p className="text-xs text-gray-500 mt-1">{formatVehicleDisplayLine(trip.vehicle)}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1 truncate">{trip.pickupLocation} → {trip.dropoffLocation}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {trip.gpsAgeSec != null ? `Last ping ${trip.gpsAgeSec}s ago` : 'No GPS ping'}
                    {trip.etaMinutes != null ? ` · ETA ~${trip.etaMinutes} min` : ' · ETA unavailable'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    type="button"
                    className="btn-secondary btn-sm min-h-[44px]"
                    onClick={() => setSelectedTripId(selectedTripId === trip.id ? null : trip.id)}
                  >
                    {selectedTripId === trip.id ? 'Hide map' : 'Show map'}
                  </button>
                  <Link href={`/admin?section=trips&tripId=${trip.id}`} className="btn-primary btn-sm inline-flex items-center gap-1 min-h-[44px]">
                    <Radio className="h-3.5 w-3.5" aria-hidden />
                    Open trip
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedTrip && (
        <Card className="p-4">
          <p className="text-sm font-semibold text-gray-900 mb-2">
            Read-only map — {selectedTrip.rider?.name ?? 'Trip'}
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Single-trip view only. Multi-driver live map is planned for a future release.
          </p>
          <TripTrackingMap
            driverLat={selectedTrip.location?.lat}
            driverLng={selectedTrip.location?.lng}
            pickupLat={selectedTrip.pickupLat}
            pickupLng={selectedTrip.pickupLng}
            dropoffLat={selectedTrip.dropoffLat}
            dropoffLng={selectedTrip.dropoffLng}
            stale={selectedTrip.gpsStale}
            height={280}
          />
        </Card>
      )}
    </div>
  );
}
