'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { DriverGpsPanel } from '@/components/DriverGpsPanel';
import {
  PageHeader,
  Card,
  Alert,
  Button,
  Badge,
  StatusBadge,
  Tabs,
  LoadingState,
  ErrorState,
  EmptyState,
  ConfirmDialog,
} from '@/components/ui';
import { tripService } from '@/services/tripService';

// ─── Types ────────────────────────────────────────────────────────────────────

type TripStatus =
  | 'SCHEDULED' | 'DRIVER_ASSIGNED' | 'PRE_TRIP' | 'ON_THE_WAY'
  | 'ARRIVED_PICKUP' | 'PICKED_UP' | 'EN_ROUTE_DROPOFF' | 'ARRIVED_DROPOFF'
  | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
type TripLegType = 'OUTBOUND' | 'RETURN';

type Trip = {
  id: string;
  status: TripStatus;
  legType: TripLegType;
  scheduledDate: string;
  scheduledPickupTime: string | null;
  scheduledDropoffTime: string | null;
  actualPickupTime: string | null;
  actualDropoffTime: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  rider: { id: string; name: string; relationship: string; school: string | null } | null;
  driver: {
    id: string;
    rating: string | null;
    profile: { fullName: string; phone: string | null; avatarUrl: string | null } | null;
  } | null;
  vehicle: { model: string; plateNumber: string; color: string | null } | null;
  subscription: { id: string; subscriptionType: string; package: { name: string } | null } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Upcoming',  value: 'upcoming'  },
  { label: 'Active',    value: 'active'    },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_BADGE_VARIANT: Record<TripStatus, 'warning' | 'info' | 'purple' | 'success' | 'danger' | 'orange'> = {
  SCHEDULED:        'warning',
  DRIVER_ASSIGNED:  'info',
  PRE_TRIP:         'purple',
  ON_THE_WAY:       'purple',
  ARRIVED_PICKUP:   'orange',
  PICKED_UP:        'orange',
  EN_ROUTE_DROPOFF: 'purple',
  ARRIVED_DROPOFF:  'orange',
  COMPLETED:        'success',
  CANCELLED:        'danger',
  NO_SHOW:          'danger',
};

const STATUS_LABEL: Record<TripStatus, string> = {
  SCHEDULED:        'Scheduled',
  DRIVER_ASSIGNED:  'Driver Assigned',
  PRE_TRIP:         'Driver Heading Out',
  ON_THE_WAY:       'En Route to Pickup',
  ARRIVED_PICKUP:   'Arrived at Pickup',
  PICKED_UP:        'Rider Picked Up',
  EN_ROUTE_DROPOFF: 'En Route to Drop-off',
  ARRIVED_DROPOFF:  'Arrived at Drop-off',
  COMPLETED:        'Completed',
  CANCELLED:        'Cancelled',
  NO_SHOW:          'No Show',
};

const CANCELLABLE: TripStatus[] = ['SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP'];
const TRACKABLE: TripStatus[]   = ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'];

function fmtTime(dt: string | null): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const [activeTab, setActiveTab]       = useState('upcoming');
  const [trips, setTrips]               = useState<Trip[]>([]);
  const [loading, setLoading]           = useState(true);
  const [pageError, setPageError]       = useState('');
  const [cancelling, setCancelling]     = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Trip | null>(null);
  const [actionMsg, setActionMsg]       = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [userRole, setUserRole]         = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((res) => { if (res.data?.role) setUserRole(res.data.role); })
      .catch(() => {/* role stays null */});
  }, []);

  const loadTrips = (filter: string) => {
    setLoading(true);
    setPageError('');
    tripService.list(filter).then((res) => {
      if (res.data) setTrips(res.data);
      else setPageError(res.error?.message ?? 'Failed to load trips.');
      setLoading(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTrips(activeTab); }, [activeTab]);

  const doCancel = async () => {
    if (!cancelTarget) return;
    const trip = cancelTarget;
    setCancelTarget(null);
    setCancelling(trip.id);
    setActionMsg(null);
    const res = await tripService.cancel(trip.id);
    setCancelling(null);
    if (res.data) {
      setActionMsg({ text: 'Trip cancelled successfully.', type: 'success' });
      loadTrips(activeTab);
    } else {
      setActionMsg({ text: res.error?.message ?? 'Cancel failed. Please try again.', type: 'error' });
    }
  };

  const isDriver = userRole === 'DRIVER';

  return (
    <AppShell>
      <PageHeader
        title="My Trips"
        subtitle={`${trips.length} ${activeTab} trip${trips.length !== 1 ? 's' : ''}`}
      />

      {/* Driver callout */}
      {isDriver && (
        <Alert variant="info" className="mb-5">
          <span className="font-semibold">Driver mode:</span> tap{' '}
          <span className="font-medium">Start Sharing Location</span> on an active trip to send live GPS updates to parents.
        </Alert>
      )}

      {actionMsg && (
        <Alert variant={actionMsg.type} className="mb-4" onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        tabs={TABS}
        activeTab={activeTab}
        onChange={(val) => { setActiveTab(val); setActionMsg(null); }}
        className="mb-5"
      />

      {loading ? (
        <LoadingState message={`Loading ${activeTab} trips…`} />
      ) : pageError ? (
        <ErrorState message={pageError} onRetry={() => loadTrips(activeTab)} />
      ) : trips.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={`No ${activeTab} trips`}
          description={
            activeTab === 'upcoming'
              ? isDriver
                ? 'No trips have been assigned to you yet.'
                : 'Trips are generated from your active subscriptions by the admin team.'
              : `No ${activeTab} trips found.`
          }
        />
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const showGps      = isDriver && TRACKABLE.includes(trip.status);
            const showTracking = !isDriver && TRACKABLE.includes(trip.status);
            const showCancel   = !isDriver && CANCELLABLE.includes(trip.status);

            return (
              <Card key={trip.id}>
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {new Date(trip.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>
                    {trip.subscription && (
                      <p className="text-sm text-gray-500 capitalize mt-0.5">
                        {trip.subscription.subscriptionType.toLowerCase()}
                        {trip.subscription.package ? ` · ${trip.subscription.package.name}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge variant={STATUS_BADGE_VARIANT[trip.status]}>
                      {STATUS_LABEL[trip.status]}
                    </StatusBadge>
                    <Badge variant={trip.legType === 'RETURN' ? 'purple' : 'info'} className="text-[10px]">
                      {trip.legType === 'RETURN' ? '← Return' : '→ Outbound'}
                    </Badge>
                  </div>
                </div>

                {/* Details */}
                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-700 mb-4">
                  {trip.rider && (
                    <div className="flex gap-1.5">
                      <span className="text-gray-400 shrink-0">Rider</span>
                      <span>{trip.rider.name} <span className="text-gray-400">({trip.rider.relationship})</span></span>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <span className="text-gray-400 shrink-0">Pickup</span>
                    <span>{fmtTime(trip.scheduledPickupTime)} · {trip.pickupLocation}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="text-gray-400 shrink-0">Dropoff</span>
                    <span>{fmtTime(trip.scheduledDropoffTime)} · {trip.dropoffLocation}</span>
                  </div>
                  {trip.actualPickupTime && (
                    <div className="flex gap-1.5">
                      <span className="text-gray-400 shrink-0">Actual pickup</span>
                      <span className="text-emerald-700 font-medium">{fmtTime(trip.actualPickupTime)}</span>
                    </div>
                  )}
                  {trip.actualDropoffTime && (
                    <div className="flex gap-1.5">
                      <span className="text-gray-400 shrink-0">Actual dropoff</span>
                      <span className="text-emerald-700 font-medium">{fmtTime(trip.actualDropoffTime)}</span>
                    </div>
                  )}
                </div>

                {/* Driver chip */}
                {trip.driver && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl mb-4">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                      {trip.driver.profile?.fullName?.[0] ?? 'D'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {trip.driver.profile?.fullName ?? 'Driver'}
                      </p>
                      {trip.driver.rating && (
                        <p className="text-xs text-amber-600 font-medium">
                          Rating {Number(trip.driver.rating).toFixed(1)}
                        </p>
                      )}
                    </div>
                    {trip.vehicle && (
                      <div className="text-xs text-gray-500 text-right shrink-0">
                        <p>{trip.vehicle.color ? `${trip.vehicle.color} ` : ''}{trip.vehicle.model}</p>
                        <p className="font-mono font-medium">{trip.vehicle.plateNumber}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {(showTracking || showCancel) && (
                  <div className="flex gap-2 flex-wrap pt-1">
                    {showTracking && (
                      <Link href={`/tracking/${trip.id}`}>
                        <Button variant="outline" size="sm">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Live Tracking
                        </Button>
                      </Link>
                    )}
                    {showCancel && (
                      <Button
                        variant="danger-outline"
                        size="sm"
                        loading={cancelling === trip.id}
                        disabled={!!cancelling}
                        onClick={() => setCancelTarget(trip)}
                      >
                        Cancel Trip
                      </Button>
                    )}
                  </div>
                )}

                {/* Driver GPS panel */}
                {showGps && <DriverGpsPanel tripId={trip.id} />}
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!cancelTarget}
        title="Cancel Trip?"
        message={`Cancel the trip on ${cancelTarget ? new Date(cancelTarget.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : ''}? This cannot be undone.`}
        confirmLabel="Cancel Trip"
        confirmVariant="danger"
        onConfirm={doCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </AppShell>
  );
}
