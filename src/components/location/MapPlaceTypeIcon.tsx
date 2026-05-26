'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  DoorOpen,
  GraduationCap,
  Hospital,
  Landmark,
  MapPin,
  Milestone,
  School,
  Signpost,
} from 'lucide-react';
import type { MapPlaceType } from '@prisma/client';

const ICONS: Record<MapPlaceType, LucideIcon> = {
  DISTRICT: MapPin,
  SCHOOL: School,
  UNIVERSITY: GraduationCap,
  MOSQUE: Landmark,
  HOSPITAL: Hospital,
  LANDMARK: Landmark,
  STREET: Signpost,
  BUILDING: Building2,
  GATE: DoorOpen,
  OTHER: Milestone,
};

export function MapPlaceTypeIcon({
  type,
  className = 'h-4 w-4 shrink-0 text-emerald-700',
}: {
  type?: string | null;
  className?: string;
}) {
  const Icon = (type && type in ICONS ? ICONS[type as MapPlaceType] : ICONS.OTHER);
  return <Icon className={className} aria-hidden />;
}

export function mapPlaceTypeIconName(type?: string | null): string {
  return type && type in ICONS ? type : 'OTHER';
}
