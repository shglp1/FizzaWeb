'use client';

import Link from 'next/link';
import { MapPin, ExternalLink, ChevronDown } from 'lucide-react';
import { Button, StatusBadge } from '@/components/ui';
import { EnterpriseCard, DataCard, InfoRow, Timeline } from '@/components/ui/enterprise';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';
import type { TripStatus } from '@/lib/trips/tripLifecycle';
import { buildGoogleMapsPlaceUrl } from '@/lib/maps/googleMapsLink';

type TripDetail = {
  id?: string;
  status?: string;
  statusReason?: string | null;
  scheduledDate?: string;
  scheduledPickupTime?: string | null;
  scheduledDropoffTime?: string | null;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  rider?: { name?: string; relationship?: string } | null;
  driver?: {
    profile?: { fullName?: string; phone?: string } | null;
    rating?: number | string | null;
  } | null;
  parent?: { profile?: { fullName?: string; phone?: string } | null } | null;
  events?: { id: string; eventType: string; message?: string | null; createdAt: string }[];
  chatBlocked?: boolean;
};

function fmtTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TripDetailDrawer({
  tripId,
  detail,
  onClose,
  onRunLateCheck,
}: {
  tripId: string;
  detail: TripDetail;
  onClose: () => void;
  onRunLateCheck?: () => void;
}) {
  const status = detail.status ?? 'SCHEDULED';
  const events = detail.events ?? [];

  const timelineItems = events.slice(0, 8).map((ev, i) => ({
    id: ev.id,
    title: ev.message ?? ev.eventType.replace(/_/g, ' '),
    time: fmtTime(ev.createdAt),
    status: (i === 0 ? 'current' : 'done') as 'done' | 'current',
  }));

  return (
    <EnterpriseCard accent className="animate-slide-up">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Trip operations</p>
          <h3 className="text-lg font-bold text-gray-900 mt-0.5">{detail.rider?.name ?? 'Trip detail'}</h3>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{tripId}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge variant="info">{getDisplayLabel(status as TripStatus)}</StatusBadge>
          {detail.chatBlocked && <StatusBadge variant="danger">Chat flagged</StatusBadge>}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close trip detail">
            Close
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <DataCard title="People & schedule">
          <InfoRow label="Rider" value={detail.rider?.name ?? '—'} />
          <InfoRow label="Relationship" value={detail.rider?.relationship ?? '—'} />
          <InfoRow label="Driver" value={detail.driver?.profile?.fullName ?? 'Unassigned'} />
          {detail.driver?.profile?.phone && (
            <InfoRow label="Driver phone" value={detail.driver.profile.phone} />
          )}
          <InfoRow label="Parent" value={detail.parent?.profile?.fullName ?? '—'} />
          <InfoRow label="Scheduled" value={fmtTime(detail.scheduledPickupTime ?? detail.scheduledDate)} />
          {detail.statusReason && (
            <InfoRow label="Reason" value={detail.statusReason} />
          )}
        </DataCard>

        <DataCard title="Route">
          <InfoRow label="Pickup" value={detail.pickupLocation ?? '—'} />
          <InfoRow label="Drop-off" value={detail.dropoffLocation ?? '—'} />
          <div className="flex flex-wrap gap-2 pt-2">
            {detail.pickupLat != null && detail.pickupLng != null && (
              <a
                href={buildGoogleMapsPlaceUrl(detail.pickupLat, detail.pickupLng, detail.pickupLocation)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Pickup map
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
            {detail.dropoffLat != null && detail.dropoffLng != null && (
              <a
                href={buildGoogleMapsPlaceUrl(detail.dropoffLat, detail.dropoffLng, detail.dropoffLocation)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                Drop-off map
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </div>
        </DataCard>
      </div>

      {timelineItems.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">Timeline</p>
          <Timeline items={timelineItems} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
        <Link href={`/tracking/${tripId}`} target="_blank" rel="noopener noreferrer">
          <Button variant="primary" size="sm">View tracking</Button>
        </Link>
        {onRunLateCheck && (
          <Button variant="outline" size="sm" onClick={onRunLateCheck}>Run late check</Button>
        )}
      </div>

      <details className="mt-4 group">
        <summary className="text-xs text-gray-400 cursor-pointer flex items-center gap-1 list-none">
          <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" aria-hidden />
          Developer raw data
        </summary>
        <pre className="mt-2 text-[10px] bg-gray-900 text-gray-100 rounded-lg p-3 overflow-auto max-h-40">
          {JSON.stringify(detail, null, 2)}
        </pre>
      </details>
    </EnterpriseCard>
  );
}
