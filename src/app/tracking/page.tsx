'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  DriverEmptyState,
  DriverErrorState,
  DriverGpsPermissionCard,
  DriverLoadingState,
  DriverPageHeader,
} from '@/components/driver/DriverUI';
import { Badge, Button, Card, StatusBadge } from '@/components/ui';
import { trackingService } from '@/services/trackingService';
import { TRIP_STATUS_LABEL } from '@/lib/trips/tripLifecycle';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import {
  DRIVER_TRACKING_LIST_COPY,
  fmtDriverTime,
  getTrackingAvailability,
} from '@/lib/ui/driverPortal';
import { ExternalLink, MapPin, Radio } from 'lucide-react';

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

const AVAILABILITY_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'gray'> = {
  active_sharing: 'success',
  available_now: 'info',
  opens_soon: 'warning',
  closed: 'gray',
  not_assigned: 'gray',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TrackingIndexPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<TrackableTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown');

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((res) => { if (res.data?.role) setUserRole(res.data.role); })
      .catch(() => {});

    if (!navigator.geolocation) {
      setGpsState('unsupported');
    } else if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((p) => {
        setGpsState(p.state === 'granted' ? 'granted' : p.state === 'denied' ? 'denied' : 'unknown');
      }).catch(() => {});
    }

    trackingService.listTrackable().then((res) => {
      if (res.data?.trips) {
        const list: TrackableTrip[] = res.data.trips;
        if (list.length === 1 && userRole !== 'DRIVER') {
          router.replace(`/tracking/${list[0]!.id}`);
          return;
        }
        setTrips(list);
      } else {
        setPageError(res.error?.message ?? 'Failed to load trips.');
      }
      setLoading(false);
    }).catch(() => {
      setPageError('Unable to connect. Please try again.');
      setLoading(false);
    });
  }, [router, userRole]);

  const isDriver = userRole === 'DRIVER';
  const subtitle = isDriver
    ? DRIVER_TRACKING_LIST_COPY.driver
    : DRIVER_TRACKING_LIST_COPY.parent;

  function checkGpsPermission() {
    if (!navigator.geolocation) {
      setGpsState('unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setGpsState('granted'),
      (err) => setGpsState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown'),
    );
  }

  return (
    <AppShell>
      <DriverPageHeader title="Live GPS" subtitle={subtitle} />

      {isDriver && (
        <div className="mb-4">
          <DriverGpsPermissionCard state={gpsState} onEnable={checkGpsPermission} />
        </div>
      )}

      {loading ? (
        <DriverLoadingState message="Loading tracking trips…" />
      ) : pageError ? (
        <DriverErrorState message={pageError} onRetry={() => window.location.reload()} />
      ) : trips.length === 0 ? (
        <DriverEmptyState
          icon={MapPin}
          title={isDriver ? 'No active tracking trips' : 'No active trips to track'}
          description={
            isDriver
              ? 'GPS sharing opens when you have an assigned trip in an active status.'
              : 'Tracking opens when a driver is assigned and heading to pickup.'
          }
        />
      ) : (
        <div className="space-y-3">
          {isDriver && (
            <p className="text-sm text-gray-600">
              Select a trip to start sharing or view the live map.
            </p>
          )}
          {!isDriver && (
            <p className="text-sm text-gray-500">Select a trip to view live tracking:</p>
          )}
          {trips.map((trip) => {
            const avail = getTrackingAvailability({
              status: trip.status,
              scheduledPickupTime: trip.scheduledPickupTime,
            });
            return (
              <Card key={trip.id} className="border-l-4 border-l-fizza-secondary">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{trip.rider?.name ?? 'Rider'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fmtDate(trip.scheduledDate)} · {fmtDriverTime(trip.scheduledPickupTime)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {trip.pickupLocation} → {trip.dropoffLocation}
                    </p>
                    {!isDriver && trip.driver?.profile && (
                      <p className="text-xs text-emerald-600 mt-1">Driver: {trip.driver.profile.fullName}</p>
                    )}
                    <Badge variant={AVAILABILITY_VARIANT[avail.availability] ?? 'gray'} className="mt-2 text-[10px]">
                      {avail.label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <StatusBadge variant="purple">
                      {TRIP_STATUS_LABEL[trip.status as TripStatus] ?? trip.status}
                    </StatusBadge>
                    <Link href={`/tracking/${trip.id}`}>
                      <Button variant="primary" size="sm">
                        <Radio className="h-3.5 w-3.5" aria-hidden />
                        {isDriver ? 'Open tracking' : 'Live map'}
                      </Button>
                    </Link>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trip.pickupLocation)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        Maps
                      </Button>
                    </a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
