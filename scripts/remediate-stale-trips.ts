/**
 * Stale trip remediation CLI — explicit actions only, fully audited.
 *
 * Default: dry-run (no mutations)
 * Apply: requires --apply --trip-id --status CANCELLED|NO_SHOW --reason --actor-id
 *
 * Run: npm run remediate:stale-trips -- --dry-run
 * Apply: npm run remediate:stale-trips -- --apply --trip-id <uuid> --status CANCELLED --reason "..." --actor-id <admin-profile-id>
 */
import { PrismaClient } from '@prisma/client';
import {
  classifyStaleTripRow,
  recommendedStaleAction,
} from '../src/lib/staleTrips/classifyStaleTrips.ts';
import { getBusinessDateKey } from '../src/lib/time/businessTimezone.ts';

const prisma = new PrismaClient();

const ALLOWED_STATUSES = new Set(['CANCELLED', 'NO_SHOW']);

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    apply: argv.includes('--apply'),
    dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
    tripId: get('--trip-id'),
    status: get('--status'),
    reason: get('--reason'),
    actorId: get('--actor-id'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const todayKey = getBusinessDateKey(new Date());
  const todayStart = `${todayKey}T00:00:00.000Z`;

  if (args.apply) {
    if (!args.tripId || !args.status || !args.reason || !args.actorId) {
      console.error('Apply mode requires: --trip-id --status CANCELLED|NO_SHOW --reason --actor-id');
      process.exitCode = 1;
      return;
    }
    if (!ALLOWED_STATUSES.has(args.status)) {
      console.error('Only CANCELLED or NO_SHOW remediation statuses are allowed.');
      process.exitCode = 1;
      return;
    }
    if (args.reason.trim().length < 10) {
      console.error('Reason must be at least 10 characters.');
      process.exitCode = 1;
      return;
    }

    const trip = await prisma.trip.findUnique({
      where: { id: args.tripId },
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        scheduledPickupTime: true,
        needsDispatch: true,
        financialReviewStatus: true,
      },
    });
    if (!trip) {
      console.error('Trip not found');
      process.exitCode = 1;
      return;
    }
    if (trip.financialReviewStatus === 'PENDING') {
      console.error('Trip has pending financial review — resolve in admin Financial Review first.');
      process.exitCode = 1;
      return;
    }

    const categories = classifyStaleTripRow(
      {
        id: trip.id,
        status: trip.status,
        scheduledDate: trip.scheduledDate.toISOString(),
        scheduledPickupTime: trip.scheduledPickupTime?.toISOString() ?? null,
        needsDispatch: trip.needsDispatch,
        financialReviewStatus: trip.financialReviewStatus,
      },
      todayStart,
    );
    if (!categories.length) {
      console.error('Trip does not match stale remediation categories — aborting.');
      process.exitCode = 1;
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({
        where: { id: args.tripId! },
        data: {
          status: args.status as 'CANCELLED' | 'NO_SHOW',
          statusReason: args.reason!.trim(),
          cancelledBy: args.actorId!,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: args.actorId!,
          action: 'STALE_TRIP_REMEDIATION',
          details: JSON.stringify({
            tripId: args.tripId,
            previousStatus: trip.status,
            newStatus: args.status,
            reason: args.reason!.trim(),
            categories,
          }),
        },
      });
    });

    console.log(`Applied ${args.status} to trip ${args.tripId}`);
    return;
  }

  console.log('Stale trip remediation — DRY RUN (no changes)\n');

  const candidates = await prisma.trip.findMany({
    where: {
      OR: [
        { scheduledDate: { lt: new Date(todayStart) }, status: { notIn: ['COMPLETED', 'CANCELLED', 'NO_SHOW'] } },
        { financialReviewStatus: 'PENDING' },
        { needsDispatch: true, scheduledDate: { lt: new Date(todayStart) } },
      ],
    },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      scheduledPickupTime: true,
      needsDispatch: true,
      financialReviewStatus: true,
    },
    take: 500,
    orderBy: { scheduledDate: 'asc' },
  });

  for (const t of candidates) {
    const categories = classifyStaleTripRow(
      {
        id: t.id,
        status: t.status,
        scheduledDate: t.scheduledDate.toISOString(),
        scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
        needsDispatch: t.needsDispatch,
        financialReviewStatus: t.financialReviewStatus,
      },
      todayStart,
    );
    if (!categories.length) continue;
    console.log([
      t.id,
      t.status,
      t.scheduledDate.toISOString().slice(0, 10),
      categories.join(','),
      recommendedStaleAction(categories),
    ].join(' | '));
  }

  console.log('\nTo apply: npm run remediate:stale-trips -- --apply --trip-id <id> --status CANCELLED --reason "..." --actor-id <admin-profile-id>');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
