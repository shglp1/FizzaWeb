'use client';

import Link from 'next/link';
import { MapPin, ExternalLink, ChevronDown, AlertTriangle } from 'lucide-react';
import { Button, StatusBadge } from '@/components/ui';
import {
  AdminDrawer,
  AdminDrawerSection,
  AdminDrawerRow,
} from '@/components/admin/AdminUI';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import {
  buildGoogleMapsPlaceUrl,
  tripToGoogleMapsUrl,
} from '@/lib/maps/googleMapsLink';
import {
  formatDispatchNoteSummary,
  formatLegType,
  formatRouteSummary,
  formatTripDateTime,
  shouldShowTechnicalJsonPrimary,
} from '@/lib/ui/adminTrips';
import type { NormalizedAdminTripDetail } from '@/lib/ui/adminTripDetail';

function fmtEventTime(iso: string) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TripDetailDrawer({
  open,
  tripId,
  detail,
  onClose,
  onAssign,
  onReassign,
}: {
  open: boolean;
  tripId: string;
  detail: NormalizedAdminTripDetail;
  onClose: () => void;
  onAssign?: () => void;
  onReassign?: () => void;
}) {
  const status = detail.status ?? 'SCHEDULED';
  const events = detail.events ?? [];
  const canAssign = detail.needsDispatch || (!detail.driver && ['SCHEDULED', 'DRIVER_ASSIGNED'].includes(status));
  const canReassign = !!detail.driver && ['SCHEDULED', 'DRIVER_ASSIGNED'].includes(status);

  return (
    <AdminDrawer
      open={open}
      onClose={onClose}
      title={detail.rider?.name ?? 'Trip detail'}
      subtitle={formatTripDateTime(detail.scheduledDate, detail.scheduledPickupTime)}
      width="lg"
      footer={
        <div className="flex flex-wrap gap-2">
          {canAssign && onAssign && (
            <Button variant="primary" size="sm" onClick={onAssign} className="min-h-[44px]">Assign driver</Button>
          )}
          {canReassign && onReassign && (
            <Button variant="outline" size="sm" onClick={onReassign} className="min-h-[44px]">Reassign driver</Button>
          )}
          <Link href={`/tracking/${tripId}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="min-h-[44px]">View tracking</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onClose} className="min-h-[44px]">Close</Button>
        </div>
      }
    >
      <AdminDrawerSection title="Trip summary">
        <AdminDrawerRow label="Status" value={<StatusBadge variant="info">{getDisplayLabel(status as TripStatus)}</StatusBadge>} />
        <AdminDrawerRow label="Leg" value={formatLegType(detail.legType)} />
        <AdminDrawerRow label="Route" value={formatRouteSummary(detail.pickupLocation, detail.dropoffLocation, 80)} />
        <AdminDrawerRow label="Rider" value={detail.rider?.name ?? '—'} />
        <AdminDrawerRow label="Parent" value={detail.parent?.profile?.fullName ?? '—'} />
        <AdminDrawerRow label="Package" value={detail.subscription?.packageName ?? detail.subscription?.subscriptionType ?? '—'} />
        {detail.statusReason && <AdminDrawerRow label="Status reason" value={detail.statusReason} />}
      </AdminDrawerSection>

      <AdminDrawerSection title="Dispatch">
        <AdminDrawerRow
          label="Dispatch status"
          value={
            detail.needsDispatch ? (
              <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Needs dispatch
              </span>
            ) : detail.driver ? 'Driver confirmed' : 'Awaiting assignment'
          }
        />
        {detail.dispatchNote && (
          <AdminDrawerRow label="Dispatch note" value={formatDispatchNoteSummary(detail.dispatchNote, 200)} />
        )}
        <AdminDrawerRow label="Assigned driver" value={detail.driver?.profile?.fullName ?? 'Unassigned'} />
        {detail.subscription?.defaultDriverName && (
          <AdminDrawerRow label="Default driver" value={detail.subscription.defaultDriverName} />
        )}
      </AdminDrawerSection>

      <AdminDrawerSection title="Location">
        <AdminDrawerRow label="Pickup" value={detail.pickupLocation} />
        <AdminDrawerRow label="Drop-off" value={detail.dropoffLocation} />
        <div className="flex flex-wrap gap-2 pt-1">
          {detail.pickupLat != null && detail.pickupLng != null && (
            <a
              href={buildGoogleMapsPlaceUrl(detail.pickupLat, detail.pickupLng, detail.pickupLocation)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline min-h-[44px] px-1"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Open pickup
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
          {detail.dropoffLat != null && detail.dropoffLng != null && (
            <a
              href={buildGoogleMapsPlaceUrl(detail.dropoffLat, detail.dropoffLng, detail.dropoffLocation)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline min-h-[44px] px-1"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden /> Open drop-off
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
          <a
            href={tripToGoogleMapsUrl(detail)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline min-h-[44px] px-1"
          >
            Route directions
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>
      </AdminDrawerSection>

      {events.length > 0 && (
        <AdminDrawerSection title="Timeline">
          <ul className="space-y-2">
            {events.slice().reverse().slice(0, 12).map((ev) => (
              <li key={ev.id} className="text-sm border-b border-gray-100 last:border-0 pb-2">
                <p className="font-medium text-gray-800">{ev.message ?? ev.eventType.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtEventTime(ev.createdAt)}</p>
              </li>
            ))}
          </ul>
        </AdminDrawerSection>
      )}

      <AdminDrawerSection title="Communication & safety">
        <AdminDrawerRow label="Chat messages" value={detail.chatTotal ?? 0} />
        <AdminDrawerRow label="Chat flags" value={detail.chatFlaggedCount ?? 0} />
        <AdminDrawerRow label="GPS" value={detail.gpsStale ? 'Stale / unavailable' : 'OK'} />
        <AdminDrawerRow label="Safety reports" value={detail.safetyReports?.length ?? 0} />
        {(detail.safetyReports?.length ?? 0) > 0 && (
          <ul className="text-xs text-gray-600 space-y-1 pt-1">
            {detail.safetyReports!.slice(0, 3).map((r) => (
              <li key={r.id}>{r.category} — {r.status}</li>
            ))}
          </ul>
        )}
      </AdminDrawerSection>

      {!shouldShowTechnicalJsonPrimary() && (
        <details className="group">
          <summary className="text-xs text-gray-400 cursor-pointer flex items-center gap-1 list-none min-h-[44px]">
            <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" aria-hidden />
            Technical details
          </summary>
          <pre className="mt-2 text-[10px] bg-gray-900 text-gray-100 rounded-lg p-3 overflow-auto max-h-40">
            {JSON.stringify({ tripId, ...detail }, null, 2)}
          </pre>
        </details>
      )}
    </AdminDrawer>
  );
}
