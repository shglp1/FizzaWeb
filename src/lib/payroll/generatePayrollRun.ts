import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.ts';
import { calculatePeriodNetPay, calculateTripEarning, roundKm } from './calculateTripEarning.ts';
import { getBillableKmForTrip } from './getBillableKm.ts';
import { loadGlobalPayRules, resolveDriverPayRules } from './payRules.ts';

export class PayrollGenerationError extends Error {
  code: 'PERIOD_EXISTS' | 'HAS_PAID_LINES' | 'NO_TRIPS';

  constructor(message: string, code: 'PERIOD_EXISTS' | 'HAS_PAID_LINES' | 'NO_TRIPS') {
    super(message);
    this.name = 'PayrollGenerationError';
    this.code = code;
  }
}

export type SkippedTrip = {
  tripId: string;
  driverId: string | null;
  scheduledDate: string;
  reason: string;
};

function periodBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

type TripRow = {
  id: string;
  driverId: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  billableKmOverride: Prisma.Decimal | null;
  actualDropoffTime: Date | null;
  updatedAt: Date;
  scheduledDate: Date;
};

export async function generatePayrollRun(input: {
  year: number;
  month: number;
  generatedById?: string | null;
  regenerate?: boolean;
  notes?: string;
  triggeredBy?: 'ADMIN' | 'CRON';
}) {
  const {
    year,
    month,
    generatedById = null,
    regenerate,
    notes,
    triggeredBy = generatedById ? 'ADMIN' : 'CRON',
  } = input;
  const { start, end } = periodBounds(year, month);

  const existing = await prisma.payrollRun.findUnique({
    where: { year_month: { year, month } },
    include: { lines: { select: { id: true, status: true } } },
  });

  if (existing && !regenerate) {
    throw new PayrollGenerationError(
      `Payroll for ${year}-${String(month).padStart(2, '0')} already exists.`,
      'PERIOD_EXISTS',
    );
  }

  if (existing?.lines.some((l) => l.status === 'PAID')) {
    throw new PayrollGenerationError(
      'Cannot regenerate a period that has paid lines.',
      'HAS_PAID_LINES',
    );
  }

  const trips = await prisma.trip.findMany({
    where: {
      status: 'COMPLETED',
      driverId: { not: null },
      scheduledDate: { gte: start, lte: end },
    },
    select: {
      id: true,
      driverId: true,
      pickupLat: true,
      pickupLng: true,
      dropoffLat: true,
      dropoffLng: true,
      billableKmOverride: true,
      actualDropoffTime: true,
      updatedAt: true,
      scheduledDate: true,
    },
    orderBy: { scheduledDate: 'asc' },
  }) as TripRow[];

  const eligibleTrips = trips.filter((t) => t.driverId);
  if (eligibleTrips.length === 0) {
    throw new PayrollGenerationError(
      'No completed trips found for this period.',
      'NO_TRIPS',
    );
  }

  const driverIds = [...new Set(eligibleTrips.map((t) => t.driverId!))];
  const payProfiles = await prisma.driverPayProfile.findMany({
    where: { driverId: { in: driverIds } },
  });
  const profileByDriver = new Map(payProfiles.map((p) => [p.driverId, p]));
  const globalRules = await loadGlobalPayRules();
  const skippedTrips: SkippedTrip[] = [];

  type LineAgg = {
    driverId: string;
    tripCount: number;
    totalBillableKm: number;
    grossSar: number;
    platformFeeSar: number;
    tripNetSar: number;
    earnings: Prisma.DriverTripEarningCreateManyInput[];
  };

  const byDriver = new Map<string, LineAgg>();

  for (const trip of eligibleTrips) {
    const driverId = trip.driverId!;
    const kmResult = await getBillableKmForTrip({
      ...trip,
      billableKmOverride: trip.billableKmOverride != null ? Number(trip.billableKmOverride) : null,
    });

    if (!kmResult) {
      skippedTrips.push({
        tripId: trip.id,
        driverId,
        scheduledDate: trip.scheduledDate.toISOString(),
        reason: 'Missing coordinates — set billable km override on the trip',
      });
      continue;
    }

    const profile = profileByDriver.get(driverId) ?? null;
    const rules = resolveDriverPayRules(globalRules, profile ? {
      ratePerKmSar: profile.ratePerKmSar != null ? Number(profile.ratePerKmSar) : null,
      platformFeePercent: profile.platformFeePercent != null ? Number(profile.platformFeePercent) : null,
    } : null);

    const amounts = calculateTripEarning({
      billableKm: kmResult.billableKm,
      ratePerKmSar: rules.ratePerKmSar,
      platformFeePercent: rules.platformFeePercent,
    });

    const tripCompletedAt = trip.actualDropoffTime ?? trip.updatedAt;

    const earning: Prisma.DriverTripEarningCreateManyInput = {
      tripId: trip.id,
      driverId,
      billableKm: kmResult.billableKm,
      kmSource: kmResult.kmSource,
      ratePerKmSar: rules.ratePerKmSar,
      platformFeePercent: rules.platformFeePercent,
      grossSar: amounts.grossSar,
      platformFeeSar: amounts.platformFeeSar,
      netSar: amounts.netSar,
      tripCompletedAt,
    };

    const agg = byDriver.get(driverId) ?? {
      driverId,
      tripCount: 0,
      totalBillableKm: 0,
      grossSar: 0,
      platformFeeSar: 0,
      tripNetSar: 0,
      earnings: [],
    };

    agg.tripCount += 1;
    agg.totalBillableKm = roundKm(agg.totalBillableKm + kmResult.billableKm);
    agg.grossSar += amounts.grossSar;
    agg.platformFeeSar += amounts.platformFeeSar;
    agg.tripNetSar += amounts.netSar;
    agg.earnings.push(earning);
    byDriver.set(driverId, agg);
  }

  if (byDriver.size === 0) {
    throw new PayrollGenerationError(
      skippedTrips.length > 0
        ? 'All completed trips are missing billable km. Set overrides and regenerate.'
        : 'No billable trips for this period.',
      'NO_TRIPS',
    );
  }

  return prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.driverTripEarning.deleteMany({
        where: { payrollLine: { payrollRunId: existing.id } },
      });
      await tx.driverPayrollLine.deleteMany({ where: { payrollRunId: existing.id } });
      await tx.payrollRun.delete({ where: { id: existing.id } });
    }

    const run = await tx.payrollRun.create({
      data: {
        year,
        month,
        status: 'GENERATED',
        triggeredBy,
        generatedById,
        notes: notes ?? null,
        skippedTripCount: skippedTrips.length,
        skippedTrips: skippedTrips.length > 0 ? skippedTrips : undefined,
      },
    });

    for (const agg of byDriver.values()) {
      const netPaySar = calculatePeriodNetPay({
        tripNetSar: agg.tripNetSar,
        deductionsSar: 0,
        bonusesSar: 0,
      });

      const line = await tx.driverPayrollLine.create({
        data: {
          payrollRunId: run.id,
          driverId: agg.driverId,
          tripCount: agg.tripCount,
          totalBillableKm: agg.totalBillableKm,
          grossSar: agg.grossSar,
          platformFeeSar: agg.platformFeeSar,
          tripNetSar: agg.tripNetSar,
          deductionsSar: 0,
          bonusesSar: 0,
          netPaySar,
          status: 'DRAFT',
        },
      });

      await tx.driverTripEarning.createMany({
        data: agg.earnings.map((e) => ({ ...e, payrollLineId: line.id })),
      });
    }

    if (generatedById) {
      await tx.auditLog.create({
        data: {
          userId: generatedById,
          action: regenerate ? 'PAYROLL_REGENERATED' : 'PAYROLL_GENERATED',
          details: JSON.stringify({
            year,
            month,
            runId: run.id,
            driverCount: byDriver.size,
            skippedTripCount: skippedTrips.length,
            triggeredBy,
          }),
        },
      });
    }

    return tx.payrollRun.findUniqueOrThrow({
      where: { id: run.id },
      include: {
        lines: {
          include: {
            driver: {
              include: {
                profile: { include: { user: { select: { email: true } } } },
              },
            },
            tripEarnings: {
              include: {
                trip: {
                  select: {
                    id: true,
                    scheduledDate: true,
                    pickupLocation: true,
                    dropoffLocation: true,
                    legType: true,
                  },
                },
              },
            },
          },
          orderBy: { netPaySar: 'desc' },
        },
      },
    });
  });
}

/** Generate payroll for the previous calendar month — used by cron. */
export async function generatePreviousMonthPayrollCron() {
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = prev.getUTCFullYear();
  const month = prev.getUTCMonth() + 1;

  try {
    const run = await generatePayrollRun({
      year,
      month,
      triggeredBy: 'CRON',
      regenerate: false,
    });
    return { ok: true as const, year, month, runId: run.id, skippedTripCount: run.skippedTripCount };
  } catch (err) {
    if (err instanceof PayrollGenerationError && err.code === 'PERIOD_EXISTS') {
      return { ok: true as const, year, month, skipped: true, reason: err.message };
    }
    throw err;
  }
}
