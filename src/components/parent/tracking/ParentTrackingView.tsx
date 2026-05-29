'use client';

import { useState } from 'react';
import { Phone, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui';
import { DriverMapFallback, DriverMapPanel } from '@/components/driver/DriverUI';
import { TripTrackingMap } from '@/components/tracking/TripTrackingMap';
import { TripChatDrawer } from '@/components/trips/TripChatDrawer';
import { ParentTrackingHeader } from './ParentTrackingHeader';
import { ParentSafetyBanner } from './ParentSafetyBanner';
import { ParentEtaCard } from './ParentEtaCard';
import { ParentTripStatusCard } from './ParentTripStatusCard';
import { ParentDriverCard } from './ParentDriverCard';
import { ParentSafetyTimeline } from './ParentSafetyTimeline';
import { ParentMapLegend } from './ParentMapLegend';
import { TripRatingPrompt } from '@/components/parent/TripRatingPrompt';
import { headlineForState, getParentTrackingCopy } from '@/lib/parent/parentTrackingCopy';
import { resolveParentTrackingState } from '@/lib/parent/parentTrackingState';
import { formatLastUpdated, legLocationLabels, toCoord } from '@/lib/parent/parentTrackingFormatters';
import { tripToGoogleMapsUrl } from '@/lib/maps/googleMapsLink';
import { hasRouteCoordinates, hasRenderableMapPoints } from '@/lib/ui/driverPortal';
import type { UseTripTrackingResult } from '@/hooks/useTripTracking';

export function ParentTrackingView({
  tracking,
  userRole,
}: {
  tracking: UseTripTrackingResult;
  userRole: string;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const copy = getParentTrackingCopy('en');
  const { trip, location, liveEta, tooEarly, routeGeometry, routeSource, routeLoading, mapLoading, setMapLoading, lastUpdatedLabel } = tracking;

  if (!trip) return null;

  const state = resolveParentTrackingState({
    status: trip.status,
    legType: trip.legType,
    hasDriver: Boolean(trip.driver),
    location: tooEarly ? null : location,
    scheduledPickupTime: trip.scheduledPickupTime,
    actualPickupTime: trip.actualPickupTime,
    actualDropoffTime: trip.actualDropoffTime,
    pickupLat: toCoord(trip.pickupLat),
    pickupLng: toCoord(trip.pickupLng),
    dropoffLat: toCoord(trip.dropoffLat),
    dropoffLng: toCoord(trip.dropoffLng),
    liveEta,
  });

  const headline = headlineForState(state.id, 'en', state.etaMinutes);
  const labels = legLocationLabels(trip.legType);
  const riderName = trip.rider?.name ?? 'Rider';

  const pickupLat = toCoord(trip.pickupLat);
  const pickupLng = toCoord(trip.pickupLng);
  const dropoffLat = toCoord(trip.dropoffLat);
  const dropoffLng = toCoord(trip.dropoffLng);

  const mapPoints = {
    driverLat: state.showDriverMarker ? location?.lat : null,
    driverLng: state.showDriverMarker ? location?.lng : null,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    stale: location?.stale,
  };

  const canRenderMap = hasRenderableMapPoints(mapPoints) || hasRouteCoordinates(trip);
  const routeMapsUrl = tripToGoogleMapsUrl({
    pickupLocation: trip.pickupLocation,
    dropoffLocation: trip.dropoffLocation,
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
  });

  const lastUpdatedText = formatLastUpdated(lastUpdatedLabel);
  const gpsOverlayLabel =
    location && !location.stale
      ? copy.gpsActive
      : tooEarly || state.id === 'waiting_for_window'
      ? copy.gpsOpensSoon
      : location?.stale
      ? copy.gpsOutdated
      : copy.gpsUnavailable;

  const driverPhone = trip.driver?.profile?.phone ?? null;

  return (
    <div className="max-w-3xl mx-auto pb-28 md:pb-6">
      <ParentTrackingHeader
        riderName={riderName}
        scheduledDate={trip.scheduledDate}
        headline={headline}
        stateId={state.id}
        onChat={() => setChatOpen(true)}
      />

      <ParentSafetyBanner
        stateId={state.id}
        actualPickupTime={trip.actualPickupTime}
        actualDropoffTime={trip.actualDropoffTime}
        riderName={riderName}
      />

      {canRenderMap ? (
        <div className="mb-4">
          <DriverMapPanel
            loading={mapLoading || routeLoading}
            mapsUrl={routeMapsUrl}
            showLegend={false}
            legend={
              <div className="flex flex-wrap items-center gap-2">
                <ParentMapLegend legType={trip.legType} />
                {routeSource === 'approximate' ? (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                    {copy.approximateRoute}
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                    {copy.roadRoute}
                  </span>
                )}
              </div>
            }
            statusOverlay={
              <div className="inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-xs font-semibold shadow-sm border border-gray-200">
                <span
                  className={`h-2 w-2 rounded-full ${
                    location && !location.stale ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  }`}
                  aria-hidden
                />
                {gpsOverlayLabel}
                {lastUpdatedText && (
                  <span className="text-gray-500 font-normal">· {copy.lastUpdated(lastUpdatedText)}</span>
                )}
              </div>
            }
            map={
              <TripTrackingMap
                {...mapPoints}
                pickupLabel={labels.pickupMarker}
                dropoffLabel={labels.dropoffMarker}
                driverLabel={copy.mapLegendDriver}
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

      <ParentEtaCard
        state={state}
        scheduledPickupTime={trip.scheduledPickupTime}
        scheduledDropoffTime={trip.scheduledDropoffTime}
      />

      <ParentTripStatusCard
        pickupLocation={trip.pickupLocation}
        dropoffLocation={trip.dropoffLocation}
        scheduledPickupTime={trip.scheduledPickupTime}
        scheduledDropoffTime={trip.scheduledDropoffTime}
        actualPickupTime={trip.actualPickupTime}
        actualDropoffTime={trip.actualDropoffTime}
        legType={trip.legType}
        statusReason={trip.statusReason}
      />

      {trip.driver?.profile && (
        <ParentDriverCard
          fullName={trip.driver.profile.fullName}
          rating={trip.driver.rating}
          phone={trip.driver.profile.phone}
          vehicle={trip.vehicle}
        />
      )}

      <ParentSafetyTimeline
        status={trip.status}
        legType={trip.legType}
        actualPickupTime={trip.actualPickupTime}
        actualDropoffTime={trip.actualDropoffTime}
      />

      {trip.status === 'COMPLETED' && trip.driver && (
        <div className="mt-4">
          <TripRatingPrompt
            tripId={trip.id}
            driverName={trip.driver.profile?.fullName}
          />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 md:hidden">
        <div className="max-w-3xl mx-auto flex gap-2">
          {driverPhone && (
            <a href={`tel:${driverPhone}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full min-h-[44px]">
                <Phone className="h-4 w-4 mr-1" aria-hidden />
                {copy.callDriver}
              </Button>
            </a>
          )}
          <Button variant="primary" size="sm" className="flex-1 min-h-[44px]" onClick={() => setChatOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-1" aria-hidden />
            {copy.messageDriver}
          </Button>
        </div>
      </div>

      {chatOpen && (
        <TripChatDrawer
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          tripId={trip.id}
          userRole={userRole}
          tripSummary={{
            riderName,
            pickup: trip.pickupLocation,
            dropoff: trip.dropoffLocation,
            scheduledPickupTime: trip.scheduledPickupTime,
          }}
        />
      )}
    </div>
  );
}
