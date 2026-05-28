/** Parent-facing tracking copy — en primary, ar scaffold for future i18n. */

import type { ParentTrackingStateId } from './parentTrackingState.ts';

export type ParentTrackingLang = 'en' | 'ar';

const COPY = {
  en: {
    pageTitle: (rider: string) => `${rider}'s trip`,
    allTrips: 'All trips',
    messageDriver: 'Message driver',
    callDriver: 'Call driver',
    driverAssigned: 'Driver assigned',
    waitingForLocation: 'Waiting for driver location',
    waitingForWindow: 'Tracking opens soon',
    driverEnRoutePickup: 'Driver is on the way to pickup',
    driverMinutesAway: (mins: number) => `Driver is about ${mins} min away`,
    arrivingSoon: 'Arriving soon',
    driverAtPickup: 'Driver reached pickup',
    studentPickedUp: 'Student picked up',
    enRouteSchool: 'On the way to school',
    enRouteHome: 'On the way home',
    arrivedSchool: 'Arrived at school',
    arrivedHome: 'Arrived home',
    pendingCompletion: 'Driver has arrived — waiting for trip completion',
    arrivedSafely: 'Arrived safely',
    tripCompleted: 'Trip completed — arrived safely',
    locationUnavailable: 'Location temporarily unavailable',
    gpsOutdated: 'GPS location is outdated',
    driverNotAssigned: 'Driver not assigned yet',
    tripCancelled: 'Trip cancelled',
    noShow: 'No show recorded',
    scheduledPickup: 'Scheduled pickup',
    scheduledDropoff: 'Scheduled drop-off',
    actualPickup: 'Picked up at',
    actualDropoff: 'Arrived at',
    liveEtaUnavailable: 'Live arrival estimate unavailable',
    scheduledIn: (mins: number) => `Scheduled pickup in ~${mins} min`,
    lastUpdated: (label: string) => `Location updated ${label}`,
    pickupLabel: 'Pickup',
    dropoffLabelSchool: 'School',
    dropoffLabelHome: 'Home',
    pickupLabelHome: 'Home',
    pickupLabelSchool: 'School',
    driver: 'Driver',
    vehicle: 'Vehicle',
    tripProgress: 'Trip progress',
    safetyTimeline: 'Safety updates',
    mapLegendDriver: 'Driver',
    mapLegendPickup: 'Pickup',
    mapLegendDropoff: 'Drop-off',
    gpsActive: 'Live location',
    gpsOpensSoon: 'Live location opens soon',
    gpsUnavailable: 'Location not available yet',
    approximateRoute: 'Approximate route shown',
    roadRoute: 'Road route',
    loading: 'Loading trip tracking…',
    notFound: 'Trip not found.',
    loadFailed: 'Failed to load tracking data.',
  },
  ar: {
    pageTitle: (rider: string) => `رحلة ${rider}`,
    allTrips: 'كل الرحلات',
    messageDriver: 'مراسلة السائق',
    callDriver: 'اتصل بالسائق',
    driverAssigned: 'تم تعيين السائق',
    waitingForLocation: 'في انتظار موقع السائق',
    waitingForWindow: 'التتبع يفتح قريباً',
    driverEnRoutePickup: 'السائق في الطريق إلى نقطة الالتقاط',
    driverMinutesAway: (mins: number) => `السائق على بعد ${mins} دقيقة تقريباً`,
    arrivingSoon: 'يصل قريباً',
    driverAtPickup: 'وصل السائق إلى نقطة الالتقاط',
    studentPickedUp: 'تم اصطحاب الطالب',
    enRouteSchool: 'في الطريق إلى المدرسة',
    enRouteHome: 'في الطريق إلى المنزل',
    arrivedSchool: 'وصل إلى المدرسة',
    arrivedHome: 'وصل إلى المنزل',
    pendingCompletion: 'وصل السائق — في انتظار إتمام الرحلة',
    arrivedSafely: 'وصل بأمان',
    tripCompleted: 'اكتملت الرحلة — وصل بأمان',
    locationUnavailable: 'الموقع غير متاح مؤقتاً',
    gpsOutdated: 'موقع GPS قديم',
    driverNotAssigned: 'لم يُعيَّن سائق بعد',
    tripCancelled: 'تم إلغاء الرحلة',
    noShow: 'لم يحضر',
    scheduledPickup: 'موعد الالتقاط',
    scheduledDropoff: 'موعد الوصول',
    actualPickup: 'تم الالتقاط الساعة',
    actualDropoff: 'وصل الساعة',
    liveEtaUnavailable: 'تقدير وقت الوصول غير متاح',
    scheduledIn: (mins: number) => `الالتقاط المجدول خلال ~${mins} دقيقة`,
    lastUpdated: (label: string) => `آخر تحديث للموقع ${label}`,
    pickupLabel: 'الالتقاط',
    dropoffLabelSchool: 'المدرسة',
    dropoffLabelHome: 'المنزل',
    pickupLabelHome: 'المنزل',
    pickupLabelSchool: 'المدرسة',
    driver: 'السائق',
    vehicle: 'المركبة',
    tripProgress: 'تقدم الرحلة',
    safetyTimeline: 'تحديثات السلامة',
    mapLegendDriver: 'السائق',
    mapLegendPickup: 'الالتقاط',
    mapLegendDropoff: 'الوجهة',
    gpsActive: 'موقع مباشر',
    gpsOpensSoon: 'يفتح الموقع المباشر قريباً',
    gpsUnavailable: 'الموقع غير متاح بعد',
    approximateRoute: 'مسار تقريبي',
    roadRoute: 'مسار على الطريق',
    loading: 'جاري تحميل التتبع…',
    notFound: 'الرحلة غير موجودة.',
    loadFailed: 'تعذر تحميل بيانات التتبع.',
  },
} as const;

export function getParentTrackingCopy(lang: ParentTrackingLang = 'en') {
  return COPY[lang];
}

export function headlineForState(
  stateId: ParentTrackingStateId,
  lang: ParentTrackingLang = 'en',
  etaMinutes?: number | null,
): string {
  const c = getParentTrackingCopy(lang);
  switch (stateId) {
    case 'driver_not_assigned':
      return c.driverNotAssigned;
    case 'waiting_for_window':
      return c.waitingForWindow;
    case 'waiting_for_location':
      return c.waitingForLocation;
    case 'driver_assigned':
      return c.driverAssigned;
    case 'driver_en_route_to_pickup':
      return c.driverEnRoutePickup;
    case 'driver_minutes_away':
      return etaMinutes != null && etaMinutes > 0 ? c.driverMinutesAway(etaMinutes) : c.arrivingSoon;
    case 'arriving_soon':
      return c.arrivingSoon;
    case 'driver_at_pickup':
      return c.driverAtPickup;
    case 'student_picked_up':
      return c.studentPickedUp;
    case 'en_route_to_school':
      return c.enRouteSchool;
    case 'en_route_to_home':
      return c.enRouteHome;
    case 'arrived_at_destination':
      return c.arrivedSchool;
    case 'arrived_home':
      return c.arrivedHome;
    case 'trip_completed':
      return c.tripCompleted;
    case 'location_unavailable':
      return c.locationUnavailable;
    case 'gps_outdated':
      return c.gpsOutdated;
    case 'trip_cancelled':
      return c.tripCancelled;
    case 'no_show':
      return c.noShow;
    default:
      return c.driverAssigned;
  }
}
