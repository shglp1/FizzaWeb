'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DriverGpsPanel } from '@/components/DriverGpsPanel';
import { DriverTripActivityPanel } from '@/components/driver/DriverTripActivityPanel';
import { DriverStatusConfirmDialog } from '@/components/driver/DriverStatusConfirmDialog';
import { TripChatDrawer } from '@/components/trips/TripChatDrawer';
import {
  DriverActionBar,
  DriverBottomActionBar,
  DriverCommandHeader,
  DriverMapFallback,
  DriverMapPanel,
  DriverNotice,
  DriverRouteTimeline,
  Navigation,
} from '@/components/driver/DriverUI';
import { TripTrackingMap } from '@/components/tracking/TripTrackingMap';
import { Card, StatusBadge, Button } from '@/components/ui';
import { TRIP_STATUS_LABEL, isTrackableStatus } from '@/lib/trips/tripLifecycle';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { MapPin, XCircle, Info, CheckCircle2, CircleOff, MessageSquare } from 'lucide-react';
import { tripToGoogleMapsUrl } from '@/lib/maps/googleMapsLink';
import {
  getDriverPrimaryAction,
  getDriverStatusActionLabel,
  hasRouteCoordinates,
  hasRenderableMapPoints,
  isWithinTrackingWindow,
  ROUTE_GEOMETRY_FALLBACK_LABEL,
} from '@/lib/ui/driverPortal';
import { tripService } from '@/services/tripService';
import { toCoord } from '@/lib/parent/parentTrackingFormatters';
import type { UseTripTrackingResult } from '@/hooks/useTripTracking';
import {
  getStatusConfirmKind,
  getStatusConfirmCopy,
  statusAdvanceNeedsGpsWarning,
} from '@/lib/ui/driverLifecycleConfirm';
import type { TripLegType } from '@/lib/tracking/trackingTypes';

const STATUS_VARIANT: Record<string, 'info' | 'warning' | 'purple' | 'orange' | 'success' | 'danger'> = {
  DRIVER_ASSIGNED: 'info',
  PRE_TRIP: 'purple',
  ON_THE_WAY: 'purple',
  ARRIVED_PICKUP: 'orange',
  PICKED_UP: 'orange',
  EN_ROUTE_DROPOFF: 'purple',
  ARRIVED_DROPOFF: 'orange',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

function fmtTime(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function minutesUntil(dt: string | null): number | null {
  if (!dt) return null;
  return Math.round((new Date(dt).getTime() - Date.now()) / 60_000);
}

type LiveGpsMode = 'live' | 'waiting_driver' | 'waiting_window' | 'ended' | 'no_driver';

function resolveLiveGpsMode(input: {
  status: string;
  trackable: boolean;
  hasLocation: boolean;
  hasDriver: boolean;
  minutesToPickup: number | null;
}): LiveGpsMode {
  const { status, trackable, hasLocation, hasDriver, minutesToPickup } = input;
  if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(status)) return 'ended';
  if (!hasDriver) return 'no_driver';
  if (hasLocation && trackable) return 'live';
  if (trackable) return 'waiting_driver';
  if (minutesToPickup != null && minutesToPickup > 10) return 'waiting_window';
  return 'waiting_driver';
}

function LiveGpsGuide({
  mode,
  minutesToPickup,
  statusLabel,
}: {
  mode: LiveGpsMode;
  minutesToPickup: number | null;
  statusLabel: string;
}) {
  const summary = mode === 'live'
    ? 'You are sharing live location. Families see updates about every 15 seconds.'
    : mode === 'waiting_driver'
    ? 'Start sharing location so families can follow the ride.'
    : mode === 'ended'
    ? `Trip is ${statusLabel.toLowerCase()}. GPS sharing has ended.`
    : 'Live GPS opens when the trip is active.';

  const tone = mode === 'live' ? 'border-emerald-200 bg-emerald-50' :
    mode === 'ended' || mode === 'no_driver' ? 'border-gray-200 bg-gray-50' :
    'border-amber-200 bg-amber-50';

  return (
    <Card className={`mb-4 border ${tone}`}>
      <div className="flex items-start gap-3">
        {mode === 'live' ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
        ) : mode === 'ended' || mode === 'no_driver' ? (
          <CircleOff className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" aria-hidden />
        ) : (
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
        )}
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {mode === 'live' ? 'Live GPS active' : mode === 'waiting_window' ? 'Live GPS opens soon' : mode === 'ended' ? 'Live GPS ended' : 'Live GPS not available yet'}
          </p>
          <p className="text-sm text-gray-600 mt-1">{summary}</p>
        </div>
      </div>
    </Card>
  );
}

export function DriverTrackingView({
  tracking,
  userRole,
}: {
  tracking: UseTripTrackingResult;
  userRole: string;
}) {
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [gpsSharing, setGpsSharing] = useState(false);
  const [confirmNext, setConfirmNext] = useState<TripStatus | null>(null);
  const [confirmReason, setConfirmReason] = useState('');
  const { trip, location, routeGeometry, routeSource, routeLoading, mapLoading, setMapLoading, lastUpdatedLabel, refresh } = tracking;

  if (!trip) return null;

  const trackable = isTrackableStatus(trip.status as TripStatus);
  const minutesToPickup = minutesUntil(trip.scheduledPickupTime);
  const isCancelled = trip.status === 'CANCELLED' || trip.status === 'NO_SHOW';
  const pickupLat = toCoord(trip.pickupLat);
  const pickupLng = toCoord(trip.pickupLng);
  const dropoffLat = toCoord(trip.dropoffLat);
  const dropoffLng = toCoord(trip.dropoffLng);
  const routeMapsUrl = tripToGoogleMapsUrl({
    pickupLocation: trip.pickupLocation,
    dropoffLocation: trip.dropoffLocation,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
  });
  const mapPoints = {
    driverLat: location?.lat,
    driverLng: location?.lng,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    stale: location?.stale,
  };
  const canRenderMap = hasRenderableMapPoints(mapPoints) || hasRouteCoordinates(trip);
  const liveGpsMode = resolveLiveGpsMode({
    status: trip.status,
    trackable,
    hasLocation: !!location,
    hasDriver: !!trip.driver,
    minutesToPickup,
  });
  const statusLabel = TRIP_STATUS_LABEL[trip.status as TripStatus] ?? trip.status;
  const legType = (trip.legType ?? 'OUTBOUND') as TripLegType;
  const driverAction = getDriverPrimaryAction(
    trip.status as TripStatus,
    isWithinTrackingWindow(trip.scheduledPickupTime),
    { legType },
  );
  const riderName = trip.rider?.name ?? 'Student';

  async function executeStatusAdvance(nextStatus: TripStatus, statusReason?: string) {
    setStatusUpdating(true);
    await tripService.updateStatus(trip!.id, nextStatus, statusReason ? { statusReason } : undefined);
    setStatusUpdating(false);
    void refresh();
  }

  function requestStatusAdvance() {
    if (!driverAction?.nextStatus) return;
    const next = driverAction.nextStatus;
    if (getStatusConfirmKind(next)) {
      setConfirmNext(next);
      setConfirmReason('');
      return;
    }
    if (statusAdvanceNeedsGpsWarning(next) && !gpsSharing) {
      setConfirmNext(next);
      setConfirmReason('');
      return;
    }
    void executeStatusAdvance(next);
  }

  async function handleConfirmAdvance() {
    if (!confirmNext) return;
    const kind = getStatusConfirmKind(confirmNext);
    if (kind === 'no_show' && !confirmReason.trim()) return;
    const reason = kind === 'no_show' ? confirmReason.trim() : undefined;
    const next = confirmNext;
    setConfirmNext(null);
    setConfirmReason('');
    await executeStatusAdvance(next, reason);
  }

  const confirmKind = confirmNext ? getStatusConfirmKind(confirmNext) : null;
  const confirmCopy = confirmKind
    ? getStatusConfirmCopy(confirmKind, riderName, legType)
    : confirmNext
    ? {
        title: 'Continue without GPS?',
        body: 'Families may not see your live location until GPS sharing is enabled.',
        confirmLabel: 'Continue anyway',
        requireReason: false,
      }
    : null;
  const showGpsWarning = !!confirmNext && !gpsSharing && statusAdvanceNeedsGpsWarning(confirmNext);

  const lastUpdated = lastUpdatedLabel ? new Date(lastUpdatedLabel) : null;

  return (
    <div className="max-w-3xl mx-auto driver-portal pb-28 md:pb-6">
      <DriverCommandHeader
        title={`Live GPS — ${trip.rider?.name ?? 'Trip'}`}
        subtitle={new Date(trip.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        gpsIndicator={location && !location.stale ? 'active' : trackable ? 'idle' : 'off'}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setChatOpen(true)}>
              <MessageSquare className="h-3.5 w-3.5 mr-1" aria-hidden />Chat
            </Button>
            <Link href="/tracking">
              <Button variant="ghost" size="sm">All trips</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-3">
        <StatusBadge variant={STATUS_VARIANT[trip.status] ?? 'info'} className="text-sm px-3 py-1.5">
          {statusLabel}
        </StatusBadge>
        {trip.statusReason && <p className="text-xs text-gray-500 mt-1">{trip.statusReason}</p>}
      </div>

      {trip.status === 'ARRIVED_DROPOFF' && (
        <DriverNotice
          variant="late"
          title="Complete the trip"
          message="Confirm the student was safely delivered to close live tracking for the family."
        />
      )}

      {location?.stale && (
        <DriverNotice variant="late" title="GPS signal delayed" message="Location shown may be up to 1 minute old." />
      )}

      {canRenderMap ? (
        <div className="mb-4">
          <DriverMapPanel
            loading={mapLoading || routeLoading}
            mapsUrl={routeMapsUrl}
            legend={
              routeSource === 'approximate' ? (
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                  {ROUTE_GEOMETRY_FALLBACK_LABEL}
                </span>
              ) : (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Road route</span>
              )
            }
            statusOverlay={
              <div className="inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-xs font-semibold shadow-sm border border-gray-200">
                <span className={`h-2 w-2 rounded-full ${location && !location.stale ? 'bg-emerald-500 animate-pulse' : liveGpsMode === 'live' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                {location && !location.stale ? 'GPS active' : liveGpsMode === 'waiting_window' ? 'GPS opens soon' : liveGpsMode === 'live' ? 'GPS active' : 'GPS unavailable'}
                {lastUpdated && location && (
                  <span className="text-gray-500 font-normal">· {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            }
            map={
              <TripTrackingMap
                {...mapPoints}
                routeGeometry={routeGeometry}
                routeSource={routeSource}
                height={320}
                className="sm:!min-h-[420px] sm:!h-[420px] rounded-none border-0"
                onReadyChange={(ready) => setMapLoading(!ready)}
              />
            }
          />
        </div>
      ) : (
        <div className="mb-4">
          <DriverMapFallback pickup={trip.pickupLocation} dropoff={trip.dropoffLocation} mapsUrl={routeMapsUrl} />
        </div>
      )}

      {liveGpsMode !== 'live' && (
        <div className="mb-4">
          <DriverNotice
            variant={liveGpsMode === 'waiting_window' ? 'soon' : 'gps'}
            title={liveGpsMode === 'waiting_window' ? 'GPS opens soon' : 'Start sharing location'}
            message={liveGpsMode === 'waiting_window'
              ? `Tracking opens about 10 minutes before pickup${minutesToPickup != null ? ` (~${minutesToPickup} min)` : ''}.`
              : 'Tap Start sharing below so families can follow the ride.'}
          />
        </div>
      )}

      <LiveGpsGuide mode={liveGpsMode} minutesToPickup={minutesToPickup} statusLabel={statusLabel} />

      {trackable && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-3">GPS sharing</p>
          <DriverGpsPanel
            tripId={trip.id}
            withinWindow={isWithinTrackingWindow(trip.scheduledPickupTime)}
            onSharingChange={setGpsSharing}
          />
          {driverAction && driverAction.kind === 'status' && driverAction.nextStatus && (
            <div className="mt-4">
              <DriverActionBar>
                <Button variant="primary" size="sm" loading={statusUpdating} onClick={requestStatusAdvance} className="min-h-9">
                  {driverAction.label}
                </Button>
                <a href={routeMapsUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm"><Navigation className="h-3.5 w-3.5" aria-hidden />Navigate</Button>
                </a>
                <Link href="/trips"><Button variant="ghost" size="sm">Route sheet</Button></Link>
              </DriverActionBar>
              {driverAction.disabledReason && <p className="text-xs text-amber-700 mt-2">{driverAction.disabledReason}</p>}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Trip details</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-xs text-gray-400">Pickup</p>
                <p className="font-medium text-gray-800">{trip.pickupLocation}</p>
                <p className="text-xs text-gray-500">Scheduled: {fmtTime(trip.scheduledPickupTime)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-xs text-gray-400">Drop-off</p>
                <p className="font-medium text-gray-800">{trip.dropoffLocation}</p>
                <p className="text-xs text-gray-500">Scheduled: {fmtTime(trip.scheduledDropoffTime)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Rider</p>
          <p className="font-semibold text-gray-900">{trip.rider?.name ?? 'Rider'}</p>
          <p className="text-xs text-gray-500 capitalize mt-1">{trip.rider?.relationship ?? 'Student'}</p>
          <p className="text-sm text-gray-600 mt-3">
            Next action: <span className="font-medium">{getDriverStatusActionLabel(trip.status as TripStatus)}</span>
          </p>
        </Card>
      </div>

      <Card className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Trip progress</p>
        {isCancelled ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
            <XCircle className="h-5 w-5 text-red-500" aria-hidden />
            <span>{statusLabel}</span>
          </div>
        ) : (
          <DriverRouteTimeline currentStatus={trip.status as TripStatus} />
        )}
      </Card>

      <DriverTripActivityPanel events={trip.events ?? []} defaultOpen={false} />

      {trackable && driverAction?.kind === 'status' && (
        <DriverBottomActionBar label="Trip actions" visible>
          <Button variant="primary" size="sm" loading={statusUpdating} onClick={requestStatusAdvance} className="flex-1 min-h-10" disabled={!driverAction.nextStatus}>
            {driverAction.label}
          </Button>
          <a href={routeMapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" size="sm" className="w-full min-h-10">Navigate</Button>
          </a>
        </DriverBottomActionBar>
      )}

      {confirmCopy && (
        <DriverStatusConfirmDialog
          open={!!confirmNext}
          title={confirmCopy.title}
          body={confirmCopy.body}
          confirmLabel={confirmCopy.confirmLabel}
          requireReason={confirmCopy.requireReason}
          reason={confirmReason}
          onReasonChange={setConfirmReason}
          showGpsWarning={showGpsWarning}
          loading={statusUpdating}
          onConfirm={handleConfirmAdvance}
          onCancel={() => { setConfirmNext(null); setConfirmReason(''); }}
        />
      )}

      {chatOpen && (
        <TripChatDrawer
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          tripId={trip.id}
          userRole={userRole}
          tripSummary={{
            riderName: trip.rider?.name ?? 'Rider',
            pickup: trip.pickupLocation,
            dropoff: trip.dropoffLocation,
            scheduledPickupTime: trip.scheduledPickupTime,
          }}
        />
      )}
    </div>
  );
}
