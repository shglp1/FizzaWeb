'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DriverRouteSheet } from '@/components/driver/DriverRouteSheet';
import { TripChatDrawer } from '@/components/trips/TripChatDrawer';
import {
  ParentPageHeader,
  ParentFilterTabs,
  ParentTripCard,
  ParentDriverBlock,
  ParentEmptyState,
  ParentLoadingState,
  ParentErrorState,
} from '@/components/parent/ParentUI';
import { Alert, Button, StatusBadge, Badge, ConfirmDialog } from '@/components/ui';
import { tripService } from '@/services/tripService';
import { TRIP_STATUS_LABEL, type TripStatus } from '@/lib/trips/tripLifecycle';
import {
  formatTripDateTime,
  formatDriverSummary,
  formatVehicleSummary,
  getTrackingAvailability,
  trackingAvailabilityLabel,
} from '@/lib/parent/parentFormatters';
import { hasSpecialNeedsIndicator } from '@/lib/riders/riderExposure';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  rider: {
    id: string;
    name: string;
    relationship: string;
    school: string | null;
    grade?: string | null;
    specialNeeds?: boolean;
  } | null;
  driver: {
    id: string;
    rating: string | null;
    profile: { fullName: string; phone: string | null; avatarUrl: string | null } | null;
  } | null;
  vehicle: { model: string; plateNumber: string; color: string | null; capacity?: number | null } | null;
  subscription: { id: string; subscriptionType: string; package: { name: string } | null } | null;
};

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
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

const CANCELLABLE: TripStatus[] = ['SCHEDULED', 'DRIVER_ASSIGNED', 'PRE_TRIP'];
const TRACKABLE: TripStatus[] = ['PRE_TRIP', 'ON_THE_WAY', 'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF'];

function fmtTime(dt: string | null): string {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatPickupLine(trip: Trip): string {
  const time = fmtTime(trip.scheduledPickupTime);
  return time ? `${time} · ${trip.pickupLocation}` : trip.pickupLocation;
}

function formatDropoffLine(trip: Trip): string {
  const time = fmtTime(trip.scheduledDropoffTime);
  return time ? `${time} · ${trip.dropoffLocation}` : trip.dropoffLocation;
}

function riderMeta(trip: Trip): string | undefined {
  if (!trip.rider) return undefined;
  const parts = [trip.rider.relationship];
  if (trip.rider.school) parts.push(trip.rider.school);
  return parts.filter(Boolean).join(' · ');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Trip | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [chatTrip, setChatTrip] = useState<Trip | null>(null);

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

  const tabsWithCounts = useMemo(
    () => TABS.map((t) => ({ ...t, count: t.id === activeTab ? trips.length : undefined })),
    [activeTab, trips.length],
  );

  const isDriver = userRole === 'DRIVER';

  if (isDriver) {
    return (
      <AppShell>
        <DriverRouteSheet />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ParentPageHeader
        title="My Trips"
        subtitle={`View and manage your family's scheduled transport`}
      />

      {actionMsg && (
        <Alert variant={actionMsg.type} className="mb-4" onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}

      <div className="mb-5">
        <ParentFilterTabs
          tabs={tabsWithCounts}
          active={activeTab}
          onChange={(id) => { setActiveTab(id); setActionMsg(null); }}
        />
      </div>

      {loading ? (
        <ParentLoadingState message={`Loading ${activeTab} trips…`} />
      ) : pageError ? (
        <ParentErrorState message={pageError} onRetry={() => loadTrips(activeTab)} />
      ) : trips.length === 0 ? (
        <ParentEmptyState
          icon={CalendarDays}
          title={`No ${activeTab} trips`}
          description={
            activeTab === 'upcoming'
              ? 'Trips are generated from your active subscriptions by the admin team.'
              : `No ${activeTab} trips found.`
          }
        />
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => {
            const showTracking = TRACKABLE.includes(trip.status);
            const showCancel = CANCELLABLE.includes(trip.status);
            const showChat = trip.driver && !['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(trip.status);
            const driverInfo = formatDriverSummary(trip.driver);
            const tracking = getTrackingAvailability(
              trip.status,
              trip.scheduledPickupTime,
              Boolean(trip.driver),
            );

            return (
              <ParentTripCard
                key={trip.id}
                dateTime={formatTripDateTime(trip.scheduledPickupTime ?? trip.scheduledDate)}
                riderName={trip.rider?.name ?? 'Rider'}
                riderMeta={riderMeta(trip)}
                specialNeeds={trip.rider ? hasSpecialNeedsIndicator(trip.rider) : false}
                pickup={formatPickupLine(trip)}
                dropoff={formatDropoffLine(trip)}
                legType={trip.legType}
                statusBadge={
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <StatusBadge variant={STATUS_BADGE_VARIANT[trip.status]}>
                      {TRIP_STATUS_LABEL[trip.status]}
                    </StatusBadge>
                    <Badge variant={trip.legType === 'RETURN' ? 'purple' : 'info'} className="text-[10px]">
                      {trip.legType === 'RETURN' ? 'Return' : 'Outbound'}
                    </Badge>
                  </div>
                }
                driverBlock={
                  trip.driver ? (
                    <ParentDriverBlock
                      name={driverInfo.name}
                      rating={driverInfo.rating}
                      avatarUrl={driverInfo.avatarUrl}
                    />
                  ) : (
                    <p className="text-xs text-gray-500">Driver assignment pending</p>
                  )
                }
                vehicle={formatVehicleSummary(trip.vehicle)}
                trackingLabel={trackingAvailabilityLabel(tracking)}
                actions={
                  (showTracking || showCancel || showChat) ? (
                    <>
                      {showChat && (
                        <Button variant="outline" size="sm" onClick={() => setChatTrip(trip)}>
                          Message driver
                        </Button>
                      )}
                      {showTracking && (
                        <Link href={`/tracking/${trip.id}`}>
                          <Button variant="outline" size="sm">Live tracking</Button>
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
                          Cancel trip
                        </Button>
                      )}
                    </>
                  ) : undefined
                }
              />
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

      {chatTrip && (
        <TripChatDrawer
          open={!!chatTrip}
          onClose={() => setChatTrip(null)}
          tripId={chatTrip.id}
          userRole="PARENT"
          tripSummary={{
            riderName: chatTrip.rider?.name ?? 'Rider',
            pickup: chatTrip.pickupLocation,
            dropoff: chatTrip.dropoffLocation,
            scheduledPickupTime: chatTrip.scheduledPickupTime,
          }}
        />
      )}
    </AppShell>
  );
}
