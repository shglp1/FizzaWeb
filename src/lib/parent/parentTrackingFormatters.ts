import type { TripLegType } from '../tracking/trackingTypes.ts';
import type { ParentTrackingLang } from './parentTrackingCopy.ts';
import { getParentTrackingCopy } from './parentTrackingCopy.ts';

const RIYADH_TZ = 'Asia/Riyadh';

export function formatTrackingTime(iso: string | null | undefined, lang: ParentTrackingLang = 'en'): string {
  if (!iso) return '—';
  const locale = lang === 'ar' ? 'ar-SA' : 'en-SA';
  return new Date(iso).toLocaleTimeString(locale, {
    timeZone: RIYADH_TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTrackingDate(iso: string | null | undefined, lang: ParentTrackingLang = 'en'): string {
  if (!iso) return '—';
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  return new Date(iso).toLocaleDateString(locale, {
    timeZone: RIYADH_TZ,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function minutesUntil(iso: string | null | undefined, nowMs = Date.now()): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - nowMs) / 60_000);
}

export function formatLastUpdated(recordedAt: string | null | undefined, nowMs = Date.now()): string | null {
  if (!recordedAt) return null;
  const diffMs = nowMs - new Date(recordedAt).getTime();
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
}

export function legLocationLabels(legType: TripLegType | null | undefined, lang: ParentTrackingLang = 'en') {
  const c = getParentTrackingCopy(lang);
  const isReturn = legType === 'RETURN';
  return {
    pickupShort: isReturn ? c.pickupLabelSchool : c.pickupLabelHome,
    dropoffShort: isReturn ? c.dropoffLabelHome : c.dropoffLabelSchool,
    pickupMarker: isReturn ? c.pickupLabelSchool : c.pickupLabelHome,
    dropoffMarker: isReturn ? c.dropoffLabelHome : c.dropoffLabelSchool,
  };
}

export function toCoord(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
