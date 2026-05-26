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
};

export type GeocodeSuggestion = {
  label: string;
  latitude: number;
  longitude: number;
  provider: string;
  providerPlaceId?: string;
};

/** Default map centre (Riyadh) when search/geolocation unavailable. */
export const DEFAULT_MAP_CENTER = { lat: 24.7136, lng: 46.6753 };

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
    searchHint: 'Type at least 3 characters to search.',
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
    searchHint: 'اكتب 3 أحرف على الأقل للبحث.',
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
    provider: 'stable-map-picker',
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
  };
}
