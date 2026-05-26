/** Pure helpers for StableMapPicker — testable without DOM/Leaflet. */

import { sanitizeMapLabel } from '../ui/mapLocation.ts';

export type MapPickerLanguage = 'en' | 'ar';
export type MapPickerMode = 'pickup' | 'dropoff';

export type SelectedLocation = {
  label: string;
  latitude: number;
  longitude: number;
  provider?: string;
};

export type StableMapLocationValue = {
  label: string;
  lat: number;
  lng: number;
  photoUrl?: string | null;
  placeId?: string | null;
  isVerifiedPlace?: boolean;
  source?: string | null;
};

export type GeocodeSuggestion = {
  label: string;
  title?: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
  provider: string;
  source?: string;
  providerBadge?: string;
  providerPlaceId?: string;
  placeId?: string;
  type?: string;
  neighborhood?: string;
  city?: string;
  region?: string;
  country?: string;
  isVerified?: boolean;
};

/** Default map centre (Riyadh) — Saudi Arabia focus when no user location. */
export const DEFAULT_MAP_CENTER = { lat: 24.7136, lng: 46.6753 };
export const DEFAULT_MAP_ZOOM_COUNTRY = 6;
export const DEFAULT_MAP_ZOOM_PLACE = 16;
export const DEFAULT_MAP_ZOOM_VERIFIED = 17;

const COPY = {
  en: {
    pickupTitle: 'Pickup location',
    dropoffTitle: 'Drop-off location',
    searchPlaceholderPickup: 'Search home, district, or landmark…',
    searchPlaceholderDropoff: 'Search school, university, or landmark…',
    useCurrentLocation: 'Use my current location',
    locating: 'Getting your location…',
    confirm: 'Confirm location',
    cancel: 'Cancel',
    change: 'Change location',
    setPickup: 'Set pickup location',
    setDropoff: 'Set drop-off location',
    confirmed: 'Location confirmed',
    editLabel: 'Edit location label',
    manualPin: 'Place pin on map manually',
    searchHint: 'Search by district, school, mosque, university, landmark, or street.',
    verifiedPlace: 'Verified place',
    externalPlace: 'External map result',
    nearestVerified: 'Nearest verified place',
    noMatchingPlace: 'No matching place found. You can place the pin manually.',
    selectedPlace: 'Selected place',
    resolvingPlace: 'Identifying place name…',
    reverseGeocodeFailed:
      'We could not identify the place name. You can edit the label manually.',
    mapLayerStandard: 'Standard',
    mapLayerDetailed: 'Detailed',
    providerSa: 'SA',
    refineHint: 'Drag the marker or tap the map to refine the exact spot.',
    searchUnavailable: 'Search is unavailable. You can still move the pin manually.',
    noResults: 'No locations found.',
    optionalPhoto: 'Optional: add a photo to help the driver find this spot.',
    addPhoto: 'Add location photo',
    removePhoto: 'Remove photo',
    coordinates: 'Coordinates',
  },
  ar: {
    pickupTitle: 'موقع الالتقاط',
    dropoffTitle: 'موقع الوصول',
    searchPlaceholderPickup: 'ابحث عن المنزل أو الحي أو معلم…',
    searchPlaceholderDropoff: 'ابحث عن المدرسة أو الجامعة أو معلم…',
    useCurrentLocation: 'استخدم موقعي الحالي',
    locating: 'جاري تحديد موقعك…',
    confirm: 'تأكيد الموقع',
    cancel: 'إلغاء',
    change: 'تغيير الموقع',
    setPickup: 'تحديد موقع الالتقاط',
    setDropoff: 'تحديد موقع الوصول',
    confirmed: 'تم تأكيد الموقع',
    editLabel: 'تعديل وصف الموقع',
    manualPin: 'تحديد الدبوس على الخريطة يدوياً',
    searchHint: 'ابحث باسم الحي، المدرسة، المسجد، الجامعة، المعلم، أو الشارع.',
    verifiedPlace: 'مكان موثّق',
    externalPlace: 'نتيجة خريطة خارجية',
    nearestVerified: 'أقرب مكان موثّق',
    noMatchingPlace: 'لم يتم العثور على مكان مطابق. يمكنك تحديد الدبوس يدوياً.',
    selectedPlace: 'المكان المحدد',
    resolvingPlace: 'جاري تحديد اسم المكان…',
    reverseGeocodeFailed:
      'تعذر تحديد اسم المكان. يمكنك تعديل الوصف يدوياً.',
    mapLayerStandard: 'عادي',
    mapLayerDetailed: 'تفصيلي',
    providerSa: 'SA',
    refineHint: 'اسحب الدبوس أو انقر على الخريطة لتحديد الموقع بدقة.',
    searchUnavailable: 'البحث غير متاح. يمكنك تحريك الدبوس يدوياً.',
    noResults: 'لم يتم العثور على مواقع.',
    optionalPhoto: 'اختياري: أضف صورة لمساعدة السائق على تحديد الموقع.',
    addPhoto: 'إضافة صورة للموقع',
    removePhoto: 'إزالة الصورة',
    coordinates: 'الإحداثيات',
  },
} as const;

export function mapPickerCopy(language: MapPickerLanguage) {
  return COPY[language];
}

export function mapPickerSectionTitle(mode: MapPickerMode, language: MapPickerLanguage): string {
  const c = mapPickerCopy(language);
  return mode === 'pickup' ? c.pickupTitle : c.dropoffTitle;
}

export function mapPickerMarkerColor(mode: MapPickerMode, isDeviceLocation = false): string {
  if (isDeviceLocation) return '#2563EB';
  return mode === 'pickup' ? '#059669' : '#DC2626';
}

export function buildDivIconHtml(color: string, size = 34): string {
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.28);box-sizing:border-box;"></div>`;
}

export function isValidConfirmedLocation(
  v: StableMapLocationValue | null | undefined,
): v is StableMapLocationValue {
  if (!v) return false;
  if (!v.label.trim()) return false;
  if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return false;
  if (v.lat < -90 || v.lat > 90) return false;
  if (v.lng < -180 || v.lng > 180) return false;
  return true;
}

export function sanitizeManualLabel(label: string, maxLen = 200): string {
  return sanitizeMapLabel(label, maxLen);
}

export function subscriptionStepRequiresLocations(
  pickup: StableMapLocationValue | null | undefined,
  dropoff: StableMapLocationValue | null | undefined,
): boolean {
  return isValidConfirmedLocation(pickup) && isValidConfirmedLocation(dropoff);
}

export function toSelectedLocation(v: StableMapLocationValue) {
  return {
    label: v.label,
    latitude: v.lat,
    longitude: v.lng,
    provider: v.source ?? 'stable-map-picker',
  };
}

export function fromSelectedLocation(
  v: { label: string; latitude: number; longitude: number; provider?: string } | null,
  photoUrl?: string | null,
): StableMapLocationValue | null {
  if (!v) return null;
  return {
    label: v.label,
    lat: v.latitude,
    lng: v.longitude,
    photoUrl: photoUrl ?? null,
    source: v.provider ?? null,
  };
}

export function suggestionDisplayTitle(s: GeocodeSuggestion): string {
  return (s.title?.trim() || s.label.trim());
}

export function suggestionDisplaySubtitle(s: GeocodeSuggestion): string {
  if (s.subtitle?.trim()) return s.subtitle.trim();
  const parts = [s.neighborhood, s.city, s.region, s.country ?? 'Saudi Arabia'].filter(Boolean);
  return parts.slice(0, 3).join(' · ') || 'Saudi Arabia';
}

export function providerBadgeLabel(provider: string, badge?: string): string {
  if (badge) return badge;
  if (provider === 'local' || provider === 'LOCAL') return 'Local';
  if (provider === 'openrouteservice' || provider === 'ORS') return 'ORS';
  return 'OSM';
}

export function suggestionProviderBadge(s: GeocodeSuggestion): string {
  return s.providerBadge ?? providerBadgeLabel(s.provider);
}

const TYPE_ICONS: Record<string, string> = {
  DISTRICT: '🏘️',
  SCHOOL: '🏫',
  UNIVERSITY: '🎓',
  MOSQUE: '🕌',
  HOSPITAL: '🏥',
  LANDMARK: '📍',
  STREET: '🛣️',
  BUILDING: '🏢',
  GATE: '🚪',
  OTHER: '📌',
};

export function mapPlaceTypeIcon(type?: string): string {
  if (!type) return '📍';
  return TYPE_ICONS[type] ?? '📍';
}

export function isLocalGeocodeSuggestion(s: GeocodeSuggestion): boolean {
  return s.source === 'LOCAL' || s.provider === 'local';
}

export function isVerifiedGeocodeSuggestion(s: GeocodeSuggestion): boolean {
  return s.isVerified === true || s.providerBadge === 'Verified';
}

export function confirmedLabelFromReverse(result: {
  label: string;
  landmark?: string | null;
  road?: string | null;
  neighborhood?: string | null;
  city?: string | null;
}): string {
  const label = result.label.trim();
  if (label.length >= 3) return label;
  const parts = [result.landmark, result.road, result.neighborhood, result.city].filter(Boolean);
  return parts.join(', ').trim() || label;
}
