'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader, Card, StatusBadge, LoadingState, ErrorState, EmptyState } from '@/components/ui';
import { trackingService } from '@/services/trackingService';
import { TRIP_STATUS_LABEL } from '@/lib/trips/tripLifecycle';
import type { TripStatus } from '@/lib/trips/tripLifecycle';

type TrackableTrip = {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  rider: { name: string } | null;
  driver: { profile: { fullName: string } | null } | null;
};

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'purple' | 'orange' | 'success'> = {
  DRIVER_ASSIGNED: 'info',
  PRE_TRIP: 'purple',
  ON_THE_WAY: 'purple',
  ARRIVED_PICKUP: 'orange',
  PICKED_UP: 'orange',
  EN_ROUTE_DROPOFF: 'purple',
  ARRIVED_DROPOFF: 'orange',
};

function fmtTime(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function TrackingIndexPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TrackableTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    trackingService.listTrackable().then((res) => {
      if (res.data?.trips) {
        const list: TrackableTrip[] = res.data.trips;
        // If only one trackable trip, redirect directly
        if (list.length === 1) {
          router.replace(`/tracking/${list[0]!.id}`);
          return;
        }
        setTrips(list);
      } else {
        setPageError(res.error?.message ?? 'Failed to load trips.');
      }
      setLoading(false);
    }).catch(() => { setPageError('Unable to connect.'); setLoading(false); });
  }, [router]);

  return (
    <AppShell>
      <PageHeader title="Live Tracking" subtitle="Track your child's active trips" />

      {loading ? (
        <LoadingState message="Looking for active trips…" />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => window.location.reload()} />
      ) : trips.length === 0 ? (
        <EmptyState
          icon="🗺️"
          title="No active trips to track"
          description="Tracking opens when a driver is assigned and heading to pickup. Check back closer to your scheduled pickup time."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Select a trip to view live tracking:</p>
          {trips.map((trip) => (
            <Link key={trip.id} href={`/tracking/${trip.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-fizza-secondary">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {trip.rider?.name ?? 'Rider'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(trip.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}{fmtTime(trip.scheduledPickupTime)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{trip.pickupLocation} → {trip.dropoffLocation}</p>
                    {trip.driver?.profile && (
                      <p className="text-xs text-emerald-600 mt-1">Driver: {trip.driver.profile.fullName}</p>
                    )}
                  </div>
                  <StatusBadge variant={STATUS_VARIANT[trip.status] ?? 'info'}>
                    {TRIP_STATUS_LABEL[trip.status as TripStatus] ?? trip.status}
                  </StatusBadge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
