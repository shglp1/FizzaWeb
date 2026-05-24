import 'server-only';
import { prisma } from '../prisma';
import { resolveEffectiveServiceDates } from '../admin/subscriptionTimeline';
import { getDispatchConfig } from './config';
import { resolveDispatchDecision } from './dispatchDecision';
import { buildTripDuplicateWhere } from './idempotency';
import { checkTimelineFeasibility, estimateLegDurationMinutes } from './feasibility';
import {
  notifyConfirmedTripAssignments,
  notifyGenerationReport,
  notifyTripNeedsDispatch,
} from './notifications';
import type { GenerateTripsResult, TimelineTrip, TripDispatchDecision } from './types';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endNorm = new Date(end);
  endNorm.setHours(0, 0, 0, 0);
  while (current <= endNorm) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function parseTime(timeStr: string, baseDate: Date): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

type LegDef = {
  legType: 'OUTBOUND' | 'RETURN';
  pickup: string;
  dropoff: string;
  time: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
};

type SubRow = {
  id: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupTime: string;
  returnTime: string | null;
  tripDirection: string;
  riderId: string | null;
  assignedDriverId: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  oneWayDistanceKm: unknown;
  startsOn: Date | null;
  endsOn: Date | null;
  createdAt: Date;
  paymentStatus: string;
  package: { billingCycle: string } | null;
  schedules: { weekday: number; isOffDay: boolean }[];
  subscriptionRiders: { riderId: string }[];
};

function isWithinServicePeriod(sub: SubRow, date: Date): boolean {
  const { startsOn, endsOn } = resolveEffectiveServiceDates({
    startsOn: sub.startsOn,
    endsOn: sub.endsOn,
    createdAt: sub.createdAt,
    package: sub.package,
  });
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  if (startsOn) {
    const s = new Date(startsOn);
    s.setHours(0, 0, 0, 0);
    if (day < s) return false;
  }
  if (endsOn) {
    const e = new Date(endsOn);
    e.setHours(0, 0, 0, 0);
    if (day > e) return false;
  }
  return true;
}

function buildLegs(sub: SubRow): LegDef[] {
  const isRoundTrip = sub.tripDirection === 'ROUND_TRIP';
  return [
    {
      legType: 'OUTBOUND',
      pickup: sub.pickupLocation,
      dropoff: sub.dropoffLocation,
      time: sub.pickupTime,
      pickupLat: sub.pickupLat,
      pickupLng: sub.pickupLng,
      dropoffLat: sub.dropoffLat,
      dropoffLng: sub.dropoffLng,
    },
    ...(isRoundTrip && sub.returnTime
      ? [{
          legType: 'RETURN' as const,
          pickup: sub.dropoffLocation,
          dropoff: sub.pickupLocation,
          time: sub.returnTime,
          pickupLat: sub.dropoffLat,
          pickupLng: sub.dropoffLng,
          dropoffLat: sub.pickupLat,
          dropoffLng: sub.pickupLng,
        }]
      : []),
  ];
}

function legDurationFromSub(sub: SubRow): number | null {
  const km = sub.oneWayDistanceKm != null ? Number(sub.oneWayDistanceKm) : null;
  if (km != null && Number.isFinite(km) && km > 0) {
    return Math.max(15, Math.ceil((km / 30) * 60));
  }
  return null;
}

async function loadDriverDayTimeline(
  driverId: string,
  date: Date,
  cache: Map<string, TimelineTrip[]>,
  excludeSubscriptionId?: string,
): Promise<TimelineTrip[]> {
  const key = `${driverId}:${toIsoDate(date)}${excludeSubscriptionId ? `:ex${excludeSubscriptionId}` : ''}`;
  if (cache.has(key)) return cache.get(key)!;

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const trips = await prisma.trip.findMany({
    where: {
      driverId,
      scheduledDate: { gte: dayStart, lt: dayEnd },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      ...(excludeSubscriptionId ? { subscriptionId: { not: excludeSubscriptionId } } : {}),
    },
    select: {
      id: true,
      scheduledPickupTime: true,
      scheduledDropoffTime: true,
      pickupLat: true,
      pickupLng: true,
      dropoffLat: true,
      dropoffLng: true,
    },
  });

  const timeline: TimelineTrip[] = trips.map((t) => ({
    id: t.id,
    scheduledPickupTime: t.scheduledPickupTime,
    scheduledDropoffTime: t.scheduledDropoffTime,
    pickupLat: t.pickupLat,
    pickupLng: t.pickupLng,
    dropoffLat: t.dropoffLat,
    dropoffLng: t.dropoffLng,
  }));

  cache.set(key, timeline);
  return timeline;
}

function updateCacheTimeline(
  cache: Map<string, TimelineTrip[]>,
  driverId: string,
  date: Date,
  trip: TimelineTrip,
  excludeSubscriptionId?: string,
) {
  const key = `${driverId}:${toIsoDate(date)}${excludeSubscriptionId ? `:ex${excludeSubscriptionId}` : ''}`;
  const existing = cache.get(key) ?? [];
  cache.set(key, [...existing, trip]);
}

export async function decideTripDispatch(input: {
  candidate: TimelineTrip;
  driverId: string | null;
  scheduledDate: Date;
  driverDayCache: Map<string, TimelineTrip[]>;
  config: Awaited<ReturnType<typeof getDispatchConfig>>;
  excludeSubscriptionId?: string;
}): Promise<TripDispatchDecision> {
  if (!input.driverId) {
    return {
      assignDriver: false,
      needsDispatch: true,
      dispatchNote: 'No default driver assigned to subscription',
      status: 'SCHEDULED',
      driverId: null,
    };
  }

  const driver = await prisma.driver.findUnique({
    where: { id: input.driverId },
    select: { id: true, isSuspended: true, vehicleId: true },
  });

  const timeline = await loadDriverDayTimeline(
    input.driverId,
    input.scheduledDate,
    input.driverDayCache,
    input.excludeSubscriptionId,
  );

  return resolveDispatchDecision({
    driverId: input.driverId,
    driverAvailable: !!(driver && !driver.isSuspended && driver.vehicleId),
    candidate: input.candidate,
    existingTimeline: timeline,
    config: input.config,
  });
}

export type GenerateOptions = {
  startDate?: Date;
  endDate?: Date;
  subscriptionId?: string;
  triggeredBy?: 'CRON' | 'ADMIN' | 'PAYMENT';
  actorUserId?: string | null;
  skipNotifications?: boolean;
};

export async function generateTrips(options: GenerateOptions = {}): Promise<GenerateTripsResult> {
  const config = await getDispatchConfig();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = options.startDate ?? today;
  const defaultEnd = new Date(today);
  defaultEnd.setDate(defaultEnd.getDate() + config.generationHorizonDays - 1);
  const endDate = options.endDate ?? defaultEnd;

  if (startDate > endDate) {
    throw new Error('startDate must be before endDate');
  }

  const diffDays = Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000);
  if (diffDays > 31) {
    throw new Error('Date range cannot exceed 31 days');
  }

  const excludedDatesConfig = await prisma.systemConfiguration.findUnique({
    where: { key: 'excludedDates' },
  });
  const excludedDates = new Set<string>(
    Array.isArray(excludedDatesConfig?.value) ? (excludedDatesConfig!.value as string[]) : [],
  );

  const subscriptions = await prisma.userSubscription.findMany({
    where: {
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      ...(options.subscriptionId ? { id: options.subscriptionId } : {}),
    },
    select: {
      id: true,
      pickupLocation: true,
      dropoffLocation: true,
      pickupTime: true,
      returnTime: true,
      tripDirection: true,
      riderId: true,
      assignedDriverId: true,
      pickupLat: true,
      pickupLng: true,
      dropoffLat: true,
      dropoffLng: true,
      oneWayDistanceKm: true,
      startsOn: true,
      endsOn: true,
      createdAt: true,
      paymentStatus: true,
      package: { select: { billingCycle: true } },
      schedules: { where: { isOffDay: false }, select: { weekday: true, isOffDay: true } },
      subscriptionRiders: { select: { riderId: true } },
    },
  });

  const dates = getDatesInRange(startDate, endDate);
  const driverDayCache = new Map<string, TimelineTrip[]>();
  const legDuration = (sub: SubRow) => legDurationFromSub(sub);

  let generatedCount = 0;
  let skippedCount = 0;
  let confirmedCount = 0;
  let needsDispatchCount = 0;
  let failedCount = 0;
  const confirmedTripIds: string[] = [];
  const needsDispatchTrips: { tripId: string; parentUserId: string | null; date: Date; pickup: Date | null; note: string }[] = [];

  for (const sub of subscriptions) {
    const activeWeekdays = new Set(sub.schedules.map((s) => s.weekday));
    if (activeWeekdays.size === 0) continue;

    const riderIds = sub.subscriptionRiders.length > 0
      ? sub.subscriptionRiders.map((sr) => sr.riderId)
      : sub.riderId ? [sub.riderId] : [];
    if (riderIds.length === 0) continue;

    const legs = buildLegs(sub as SubRow);
    const subLegDuration = legDuration(sub as SubRow);

    for (const date of dates) {
      if (!isWithinServicePeriod(sub as SubRow, date)) continue;

      const weekday = date.getDay();
      if (!activeWeekdays.has(weekday)) continue;

      const dateStr = toIsoDate(date);
      if (excludedDates.has(dateStr)) continue;

      for (const riderId of riderIds) {
        for (const leg of legs) {
          try {
            const existing = await prisma.trip.findFirst({
              where: buildTripDuplicateWhere({
                subscriptionId: sub.id,
                riderId,
                scheduledDate: date,
                legType: leg.legType,
              }),
              select: { id: true },
            });
            if (existing) {
              skippedCount++;
              continue;
            }

            const pickupTime = parseTime(leg.time, date);
            const candidateId = `pending-${sub.id}-${riderId}-${dateStr}-${leg.legType}`;
            const candidate: TimelineTrip = {
              id: candidateId,
              scheduledPickupTime: pickupTime,
              scheduledDropoffTime: null,
              pickupLat: leg.pickupLat,
              pickupLng: leg.pickupLng,
              dropoffLat: leg.dropoffLat,
              dropoffLng: leg.dropoffLng,
              legDurationMinutes: subLegDuration,
            };

            const decision = await decideTripDispatch({
              candidate,
              driverId: sub.assignedDriverId,
              scheduledDate: date,
              driverDayCache,
              config,
            });

            const created = await prisma.trip.create({
              data: {
                subscriptionId: sub.id,
                riderId,
                driverId: decision.driverId,
                scheduledDate: date,
                scheduledPickupTime: pickupTime,
                pickupLocation: leg.pickup,
                dropoffLocation: leg.dropoff,
                pickupLat: leg.pickupLat,
                pickupLng: leg.pickupLng,
                dropoffLat: leg.dropoffLat,
                dropoffLng: leg.dropoffLng,
                legType: leg.legType,
                status: decision.status,
                needsDispatch: decision.needsDispatch,
                dispatchNote: decision.dispatchNote,
              },
              select: {
                id: true,
                subscription: { select: { userId: true } },
              },
            });

            generatedCount++;

            if (decision.assignDriver) {
              confirmedCount++;
              confirmedTripIds.push(created.id);
              if (sub.assignedDriverId) {
                updateCacheTimeline(driverDayCache, sub.assignedDriverId, date, {
                  ...candidate,
                  id: created.id,
                });
              }
            } else if (decision.needsDispatch) {
              needsDispatchCount++;
              const urgent = pickupTime.getTime() - Date.now() < 24 * 60 * 60 * 1000;
              needsDispatchTrips.push({
                tripId: created.id,
                parentUserId: created.subscription?.userId ?? null,
                date,
                pickup: pickupTime,
                note: decision.dispatchNote ?? 'Needs dispatch',
              });
              if (!options.skipNotifications && urgent) {
                await notifyTripNeedsDispatch({
                  tripId: created.id,
                  scheduledDate: date,
                  scheduledPickupTime: pickupTime,
                  parentUserId: created.subscription?.userId ?? null,
                  dispatchNote: decision.dispatchNote ?? 'Needs dispatch',
                  urgent: true,
                });
              }
            }
          } catch {
            failedCount++;
          }
        }
      }
    }
  }

  await prisma.tripGenerationLog.create({
    data: {
      runDate: today,
      generatedCount,
      failedCount,
      notes: `${options.triggeredBy ?? 'ADMIN'}. Range: ${toIsoDate(startDate)} – ${toIsoDate(endDate)}. Confirmed: ${confirmedCount}, needs dispatch: ${needsDispatchCount}, skipped: ${skippedCount}. Subscriptions: ${subscriptions.length}.`,
    },
  });

  if (options.actorUserId) {
    await prisma.auditLog.create({
      data: {
        userId: options.actorUserId,
        action: 'TRIPS_GENERATED',
        details: JSON.stringify({
          startDate: toIsoDate(startDate),
          endDate: toIsoDate(endDate),
          generatedCount,
          confirmedCount,
          needsDispatchCount,
          skippedCount,
          failedCount,
          triggeredBy: options.triggeredBy ?? 'ADMIN',
        }),
      },
    });
  }

  if (!options.skipNotifications) {
    await notifyGenerationReport({
      generatedCount,
      confirmedCount,
      needsDispatchCount,
      skippedCount,
      startDate: toIsoDate(startDate),
      endDate: toIsoDate(endDate),
      triggeredBy: options.triggeredBy ?? 'ADMIN',
    });
    await notifyConfirmedTripAssignments(confirmedTripIds);
  }

  return {
    generatedCount,
    skippedCount,
    confirmedCount,
    needsDispatchCount,
    failedCount,
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
    subscriptionsChecked: subscriptions.length,
  };
}

/** Re-evaluate future trips for a subscription after driver assignment change. */
export async function redispatchSubscriptionTrips(
  subscriptionId: string,
  driverId: string | null,
  effectiveFrom: Date,
): Promise<{ confirmed: number; needsDispatch: number }> {
  const config = await getDispatchConfig();
  const driverDayCache = new Map<string, TimelineTrip[]>();

  const trips = await prisma.trip.findMany({
    where: {
      subscriptionId,
      scheduledDate: { gte: effectiveFrom },
      status: { in: ['SCHEDULED', 'DRIVER_ASSIGNED'] },
    },
    select: {
      id: true,
      scheduledDate: true,
      scheduledPickupTime: true,
      scheduledDropoffTime: true,
      pickupLat: true,
      pickupLng: true,
      dropoffLat: true,
      dropoffLng: true,
      subscription: { select: { oneWayDistanceKm: true, userId: true } },
    },
    orderBy: [{ scheduledDate: 'asc' }, { scheduledPickupTime: 'asc' }],
  });

  let confirmed = 0;
  let needsDispatch = 0;
  const confirmedIds: string[] = [];

  for (const trip of trips) {
    if (!driverId) {
      await prisma.trip.update({
        where: { id: trip.id },
        data: {
          driverId: null,
          status: 'SCHEDULED',
          needsDispatch: true,
          dispatchNote: 'No default driver assigned',
        },
      });
      needsDispatch++;
      continue;
    }

    const legMin = trip.subscription?.oneWayDistanceKm != null
      ? estimateLegDurationMinutes({
          id: trip.id,
          scheduledPickupTime: trip.scheduledPickupTime,
          scheduledDropoffTime: trip.scheduledDropoffTime,
          pickupLat: trip.pickupLat,
          pickupLng: trip.pickupLng,
          dropoffLat: trip.dropoffLat,
          dropoffLng: trip.dropoffLng,
          legDurationMinutes: legDurationFromSub({ oneWayDistanceKm: trip.subscription.oneWayDistanceKm } as SubRow),
        }, config)
      : null;

    const candidate: TimelineTrip = {
      id: trip.id,
      scheduledPickupTime: trip.scheduledPickupTime,
      scheduledDropoffTime: trip.scheduledDropoffTime,
      pickupLat: trip.pickupLat,
      pickupLng: trip.pickupLng,
      dropoffLat: trip.dropoffLat,
      dropoffLng: trip.dropoffLng,
      legDurationMinutes: legMin,
    };

    const decision = await decideTripDispatch({
      candidate,
      driverId,
      scheduledDate: trip.scheduledDate,
      driverDayCache,
      config,
      excludeSubscriptionId: subscriptionId,
    });

    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        driverId: decision.driverId,
        status: decision.status,
        needsDispatch: decision.needsDispatch,
        dispatchNote: decision.dispatchNote,
      },
    });

    if (decision.assignDriver) {
      confirmed++;
      confirmedIds.push(trip.id);
    } else {
      needsDispatch++;
    }
  }

  await notifyConfirmedTripAssignments(confirmedIds);
  return { confirmed, needsDispatch };
}

export async function runDispatchHealthCheck(): Promise<{ checked: number; flagged: number }> {
  const config = await getDispatchConfig();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + config.generationHorizonDays);

  const trips = await prisma.trip.findMany({
    where: {
      scheduledDate: { gte: today, lte: horizon },
      status: { in: ['SCHEDULED', 'DRIVER_ASSIGNED'] },
      driverId: { not: null },
    },
    select: {
      id: true,
      driverId: true,
      scheduledDate: true,
      needsDispatch: true,
      scheduledPickupTime: true,
      scheduledDropoffTime: true,
      pickupLat: true,
      pickupLng: true,
      dropoffLat: true,
      dropoffLng: true,
    },
    orderBy: [{ driverId: 'asc' }, { scheduledDate: 'asc' }, { scheduledPickupTime: 'asc' }],
  });

  const byDriverDay = new Map<string, typeof trips>();
  for (const t of trips) {
    if (!t.driverId) continue;
    const key = `${t.driverId}:${toIsoDate(t.scheduledDate)}`;
    const list = byDriverDay.get(key) ?? [];
    list.push(t);
    byDriverDay.set(key, list);
  }

  let flagged = 0;
  for (const [, dayTrips] of byDriverDay) {
    const timeline: TimelineTrip[] = dayTrips.map((t) => ({
      id: t.id,
      scheduledPickupTime: t.scheduledPickupTime,
      scheduledDropoffTime: t.scheduledDropoffTime,
      pickupLat: t.pickupLat,
      pickupLng: t.pickupLng,
      dropoffLat: t.dropoffLat,
      dropoffLng: t.dropoffLng,
    }));

    const { issues } = await checkTimelineFeasibility(timeline, config);

    for (const issue of issues) {
      const trip = dayTrips.find((t) => t.id === issue.tripId);
      if (!trip || trip.needsDispatch) continue;
      await prisma.trip.update({
        where: { id: trip.id },
        data: {
          needsDispatch: true,
          dispatchNote: issue.message,
          driverId: null,
          status: 'SCHEDULED',
        },
      });
      flagged++;
    }
  }

  if (flagged > 0) {
    await notifyGenerationReport({
      generatedCount: 0,
      confirmedCount: 0,
      needsDispatchCount: flagged,
      skippedCount: 0,
      startDate: toIsoDate(today),
      endDate: toIsoDate(horizon),
      triggeredBy: 'CRON',
    });
  }

  return { checked: trips.length, flagged };
}
