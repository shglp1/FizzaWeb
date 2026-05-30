'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  DriverCommandHeader,
  DriverEmptyState,
  DriverErrorState,
  DriverGpsPermissionCard,
  DriverLoadingState,
  DriverNotice,
  DriverRouteCard,
  DriverTrackingGroup,
} from '@/components/driver/DriverUI';
import { Button, PageHeader } from '@/components/ui';
import { trackingService } from '@/services/trackingService';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import {
  DRIVER_TRACKING_LIST_COPY,
  TRACKING_GROUP_LABELS,
  explainStaleTripReason,
  formatTripDateTimeInBusinessTz,
  getTrackingAvailability,
  groupTripsByTrackingAvailability,
} from '@/lib/ui/driverPortal';
import {
  groupParentTripsByTracking,
  PARENT_TRACKING_GROUP_LABELS,
} from '@/lib/parent/parentFormatters';
import { ExternalLink, MapPin, Radio } from 'lucide-react';

type TrackableTrip = {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  legType?: 'OUTBOUND' | 'RETURN';
  rider: { name: string } | null;
  driver: { profile: { fullName: string } | null } | null;
};

function TrackingTripCard({ trip, isDriver }: { trip: TrackableTrip; isDriver: boolean }) {
  const avail = getTrackingAvailability({
    status: trip.status,
    scheduledDate: trip.scheduledDate,
    scheduledPickupTime: trip.scheduledPickupTime,
  });
  const needsReview = avail.availability === 'needs_review';

  return (
    <DriverRouteCard
      time={formatTripDateTimeInBusinessTz(trip)}
      riderName={trip.rider?.name ?? 'Rider'}
      riderMeta={needsReview ? explainStaleTripReason(trip) : undefined}
      pickup={trip.pickupLocation}
      dropoff={trip.dropoffLocation}
      legType={trip.legType ?? 'OUTBOUND'}
      status={trip.status as TripStatus}
      primaryAction={isDriver && avail.availability === 'available_now' ? 'Start sharing' : undefined}
      primaryDisabled={needsReview || avail.availability === 'opens_soon' || avail.availability === 'not_assigned'}
      primaryDisabledReason={
        needsReview
          ? explainStaleTripReason(trip)
          : avail.availability === 'opens_soon'
          ? avail.label
          : undefined
      }
      secondaryActions={
        <>
          <Link href={`/tracking/${trip.id}`}>
            <Button variant="primary" size="sm" className="min-h-9">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              Open live map
            </Button>
          </Link>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trip.pickupLocation)}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Maps</Button>
          </a>
        </>
      }
    />
  );
}

const DRIVER_GROUP_ORDER = ['available_now', 'opens_soon', 'upcoming', 'needs_review'] as const;

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
        const list: TrackableTrip[] = res.data.trips as TrackableTrip[];
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

  function checkGpsPermission() {
    if (!navigator.geolocation) { setGpsState('unsupported'); return; }
    navigator.geolocation.getCurrentPosition(
      () => setGpsState('granted'),
      (err) => setGpsState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unknown'),
    );
  }

  const grouped = isDriver ? groupTripsByTrackingAvailability(trips) : groupParentTripsByTracking(trips);
  const groupLabels = isDriver ? TRACKING_GROUP_LABELS : PARENT_TRACKING_GROUP_LABELS;
  const hasTrackableTrips = DRIVER_GROUP_ORDER.some((key) => grouped[key].length > 0);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto driver-portal pb-24 md:pb-6">
        {isDriver ? (
          <DriverCommandHeader title="Live GPS" subtitle={DRIVER_TRACKING_LIST_COPY.driver} />
        ) : (
          <PageHeader title="Live Tracking" subtitle={DRIVER_TRACKING_LIST_COPY.parent} />
        )}

        {isDriver && (
          <div className="mb-4 space-y-2">
            <DriverGpsPermissionCard state={gpsState} onEnable={checkGpsPermission} />
            {gpsState === 'granted' && (
              <DriverNotice variant="gps" title="Ready to share" message="Open a trip below and tap Start sharing when eligible." />
            )}
          </div>
        )}

        {loading ? (
          <DriverLoadingState message="Loading tracking trips…" />
        ) : pageError ? (
          <DriverErrorState message={pageError} onRetry={() => window.location.reload()} />
        ) : !hasTrackableTrips ? (
          <DriverEmptyState
            icon={MapPin}
            title={isDriver ? 'No active tracking trips' : 'No active trips to track'}
            description={isDriver ? 'GPS sharing opens when you have an assigned trip in an active status.' : 'Tracking opens when a driver is assigned and heading to pickup.'}
          />
        ) : grouped ? (
          <div className="space-y-5">
            {DRIVER_GROUP_ORDER.map((key) =>
              grouped[key].length > 0 ? (
                <DriverTrackingGroup
                  key={key}
                  title={groupLabels[key]}
                  description={key === 'needs_review' ? 'Contact support — these trips require admin review.' : undefined}
                >
                  {grouped[key].map((trip) => (
                    <TrackingTripCard key={trip.id} trip={trip as TrackableTrip} isDriver={isDriver} />
                  ))}
                </DriverTrackingGroup>
              ) : null,
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => (
              <TrackingTripCard key={trip.id} trip={trip} isDriver={isDriver} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
