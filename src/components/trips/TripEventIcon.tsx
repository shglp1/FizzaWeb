import type { LucideIcon } from 'lucide-react';
import {
  Car,
  MapPin,
  Flag,
  CheckCircle,
  School,
  PartyPopper,
  Clock,
  XCircle,
  RefreshCw,
  TriangleAlert,
  Circle,
} from 'lucide-react';

const EVENT_ICONS: Record<string, LucideIcon> = {
  DRIVER_ASSIGNED: Car,
  LOCATION_SHARING: MapPin,
  NEAR_PICKUP: MapPin,
  ARRIVED_PICKUP: Flag,
  RIDER_PICKED_UP: CheckCircle,
  NEAR_DROPOFF: MapPin,
  ARRIVED_DROPOFF: School,
  TRIP_COMPLETED: PartyPopper,
  DRIVER_LATE: Clock,
  RIDER_LATE: Clock,
  TRIP_CANCELLED: XCircle,
  NO_SHOW: XCircle,
  STATUS_CHANGE: RefreshCw,
  CHAT_MESSAGE_FLAGGED: TriangleAlert,
};

export function TripEventIcon({
  eventType,
  className = 'h-4 w-4 text-fizza-secondary shrink-0',
}: {
  eventType: string;
  className?: string;
}) {
  const Icon = EVENT_ICONS[eventType] ?? Circle;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
