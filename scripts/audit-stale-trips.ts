/**
 * Read-only audit: stale non-terminal trips and pickup/date mismatches (Asia/Riyadh).
 *
 * Run: npm run audit:stale-trips
 * JSON: npm run audit:stale-trips -- --json
 *
 * Does NOT modify data.
 */
import { PrismaClient } from '@prisma/client';
import {
  explainStaleTripReason,
  getBusinessDateKey,
  getTripBusinessDateKey,
  isTripStaleNonTerminal,
} from '../src/lib/time/businessTimezone.ts';
import {
  classifyStaleTripRow,
  recommendedStaleAction,
  type StaleTripCategory,
} from '../src/lib/staleTrips/classifyStaleTrips.ts';

const prisma = new PrismaClient();

const NON_TERMINAL = [
  'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY',
  'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
] as const;

const jsonMode = process.argv.includes('--json');

function log(...args: unknown[]) {
  if (!jsonMode) console.log(...args);
}

async function main() {
  const todayKey = getBusinessDateKey(new Date());
  const todayStart = new Date(`${todayKey}T00:00:00.000Z`);
  const todayStartIso = todayStart.toISOString();

  log('Fizza stale trip audit (Asia/Riyadh)');
  log(`Business today: ${todayKey}\n`);

  const staleCandidates = await prisma.trip.findMany({
    where: {
      scheduledDate: { lt: todayStart },
      status: { in: [...NON_TERMINAL] },
    },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      scheduledPickupTime: true,
      needsDispatch: true,
      financialReviewStatus: true,
      driver: { select: { profile: { select: { fullName: true } } } },
      rider: { select: { name: true } },
    },
    orderBy: [{ scheduledDate: 'asc' }, { scheduledPickupTime: 'asc' }],
    take: 500,
  });

  const stale = staleCandidates.filter((t) =>
    isTripStaleNonTerminal({
      status: t.status,
      scheduledDate: t.scheduledDate.toISOString(),
      scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
    }),
  );

  log(`--- Stale non-terminal (scheduled before ${todayKey}) ---`);
  log(`Count: ${stale.length}`);
  for (const t of stale) {
    const trip = {
      status: t.status,
      scheduledDate: t.scheduledDate.toISOString(),
      scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
    };
    log([
      t.id,
      t.status,
      t.scheduledDate.toISOString().slice(0, 10),
      t.scheduledPickupTime?.toISOString() ?? '—',
      t.rider?.name ?? '—',
      t.driver?.profile?.fullName ?? '—',
      explainStaleTripReason(trip),
    ].join(' | '));
  }

  const recent = await prisma.trip.findMany({
    where: {
      scheduledPickupTime: { not: null },
      scheduledDate: { gte: new Date(Date.now() - 90 * 86_400_000) },
    },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      scheduledPickupTime: true,
    },
    orderBy: { scheduledDate: 'desc' },
    take: 2000,
  });

  const mismatches = recent.filter((t) => {
    const scheduledKey = t.scheduledDate.toISOString().slice(0, 10);
    const businessKey = getTripBusinessDateKey({
      scheduledDate: t.scheduledDate.toISOString(),
      scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
    });
    return scheduledKey !== businessKey;
  });

  log('\n--- Pickup business date ≠ scheduledDate (sample) ---');
  log(`Count (last 90 days sample): ${mismatches.length}`);
  for (const t of mismatches.slice(0, 50)) {
    const businessKey = getTripBusinessDateKey({
      scheduledDate: t.scheduledDate.toISOString(),
      scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
    });
    log([
      t.id,
      t.status,
      t.scheduledDate.toISOString().slice(0, 10),
      businessKey,
      t.scheduledPickupTime?.toISOString() ?? '—',
    ].join(' | '));
  }

  log('\n--- Old needsDispatch rows (scheduled before today) ---');
  const oldDispatch = await prisma.trip.findMany({
    where: {
      scheduledDate: { lt: todayStart },
      needsDispatch: true,
      status: 'SCHEDULED',
    },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      scheduledPickupTime: true,
      dispatchNote: true,
      financialReviewStatus: true,
    },
    orderBy: { scheduledDate: 'asc' },
    take: 100,
  });
  log(`Count: ${oldDispatch.length}`);
  for (const t of oldDispatch.slice(0, 20)) {
    log([
      t.id,
      t.status,
      t.scheduledDate.toISOString().slice(0, 10),
      t.dispatchNote?.slice(0, 60) ?? '—',
    ].join(' | '));
  }

  log('\n--- Financial review pending ---');
  const finPending = await prisma.trip.count({ where: { financialReviewStatus: 'PENDING' } });
  const paymentAction = await prisma.trip.count({
    where: {
      OR: [
        { financialReviewStatus: 'REFUND_PARENT' },
        { financialReviewStatus: 'CREDIT_PARENT', walletCreditTransactionId: null },
      ],
    },
  });
  log(`PENDING (payroll held): ${finPending}`);
  log(`Payment action required (refund or uncredited credit): ${paymentAction}`);

  const classificationRows = [
    ...stale.map((t) => ({
      id: t.id,
      status: t.status,
      scheduledDate: t.scheduledDate.toISOString(),
      scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
      needsDispatch: t.needsDispatch,
      financialReviewStatus: t.financialReviewStatus,
    })),
    ...oldDispatch.map((t) => ({
      id: t.id,
      status: t.status,
      scheduledDate: t.scheduledDate.toISOString(),
      scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
      needsDispatch: true,
      financialReviewStatus: t.financialReviewStatus,
    })),
    ...mismatches.map((t) => ({
      id: t.id,
      status: t.status,
      scheduledDate: t.scheduledDate.toISOString(),
      scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
      scheduledDateKey: t.scheduledDate.toISOString().slice(0, 10),
      businessDateKey: getTripBusinessDateKey({
        scheduledDate: t.scheduledDate.toISOString(),
        scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
      }),
    })),
  ];

  const byCategory: Record<StaleTripCategory, string[]> = {
    old_needs_dispatch: [],
    stale_non_terminal: [],
    stuck_active: [],
    pending_financial_review: [],
    date_mismatch: [],
  };

  const classified = new Map<string, { id: string; categories: StaleTripCategory[]; recommended: string }>();
  for (const row of classificationRows) {
    const categories = classifyStaleTripRow(row, todayStartIso);
    if (categories.length === 0) continue;
    for (const c of categories) {
      if (!byCategory[c].includes(row.id)) byCategory[c].push(row.id);
    }
    classified.set(row.id, {
      id: row.id,
      categories,
      recommended: recommendedStaleAction(categories),
    });
  }

  log('\n--- Classification summary ---');
  for (const [cat, ids] of Object.entries(byCategory)) {
    log(`${cat}: ${ids.length}`);
  }

  log('\nRecommendation: review stale rows in admin Trip Operations board.');
  log('Dry-run remediation: npm run remediate:stale-trips');
  log('Do not auto-complete or delete — use explicit remediation flags.');

  if (jsonMode) {
    console.log(JSON.stringify({
      businessDate: todayKey,
      counts: {
        staleNonTerminal: stale.length,
        dateMismatches: mismatches.length,
        oldNeedsDispatch: oldDispatch.length,
        financialReviewPending: finPending,
        paymentActionRequired: paymentAction,
        byCategory: Object.fromEntries(
          Object.entries(byCategory).map(([k, v]) => [k, v.length]),
        ),
      },
      classified: [...classified.values()],
      byCategory,
    }, null, 2));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
