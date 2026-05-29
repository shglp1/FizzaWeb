/**
 * Read-only audit: stale non-terminal trips and pickup/date mismatches (Asia/Riyadh).
 *
 * Run: npm run audit:stale-trips
 *
 * Does NOT modify data. Forward trip generation fixes apply only to newly created rows.
 */
import { PrismaClient } from '@prisma/client';
import {
  explainStaleTripReason,
  getBusinessDateKey,
  getTripBusinessDateKey,
  isTripStaleNonTerminal,
} from '../src/lib/time/businessTimezone.ts';

const prisma = new PrismaClient();

const NON_TERMINAL = [
  'DRIVER_ASSIGNED', 'PRE_TRIP', 'ON_THE_WAY',
  'ARRIVED_PICKUP', 'PICKED_UP', 'EN_ROUTE_DROPOFF', 'ARRIVED_DROPOFF',
] as const;

async function main() {
  const todayKey = getBusinessDateKey(new Date());
  const todayStart = new Date(`${todayKey}T00:00:00.000Z`);

  console.log('Fizza stale trip audit (Asia/Riyadh)');
  console.log(`Business today: ${todayKey}\n`);

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

  console.log(`--- Stale non-terminal (scheduled before ${todayKey}) ---`);
  console.log(`Count: ${stale.length}`);
  for (const t of stale) {
    const trip = {
      status: t.status,
      scheduledDate: t.scheduledDate.toISOString(),
      scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
    };
    console.log([
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

  console.log('\n--- Pickup business date ≠ scheduledDate (sample) ---');
  console.log(`Count (last 90 days sample): ${mismatches.length}`);
  for (const t of mismatches.slice(0, 50)) {
    const businessKey = getTripBusinessDateKey({
      scheduledDate: t.scheduledDate.toISOString(),
      scheduledPickupTime: t.scheduledPickupTime?.toISOString() ?? null,
    });
    console.log([
      t.id,
      t.status,
      t.scheduledDate.toISOString().slice(0, 10),
      businessKey,
      t.scheduledPickupTime?.toISOString() ?? '—',
    ].join(' | '));
  }

  console.log('\nRecommendation: review stale rows in admin Trip Operations board.');
  console.log('Do not auto-complete or delete — use existing admin cancel/override flows.');
  console.log('New trips generated after this fix use Asia/Riyadh pickup times.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
