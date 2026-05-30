/**
 * Cancel non-terminal trips for inactive (non-ACTIVE) subscriptions.
 *
 * Default: dry-run
 * Apply: npm run reconcile:inactive-sub-trips -- --apply --actor-id <admin-profile-uuid> --reason "..."
 */
import { PrismaClient } from '@prisma/client';
import { reconcileInactiveSubscriptionTrips } from '../src/lib/subscriptions/subscriptionTripLifecycle.ts';

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    apply: argv.includes('--apply'),
    actorId: get('--actor-id'),
    reason: get('--reason') ?? 'Subscription inactive — operational trips voided',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.apply && !args.actorId) {
    console.error('Apply mode requires --actor-id <admin-profile-uuid>');
    process.exitCode = 1;
    return;
  }
  if (args.apply && args.reason.trim().length < 10) {
    console.error('Reason must be at least 10 characters.');
    process.exitCode = 1;
    return;
  }

  console.log(args.apply ? 'APPLY — cancelling trips' : 'DRY RUN — no mutations\n');

  const result = await reconcileInactiveSubscriptionTrips({
    apply: args.apply,
    actorUserId: args.actorId ?? 'system-reconcile',
    reason: args.reason,
  });

  console.log(`Inactive subscriptions with open trips: ${result.subscriptionsAffected}`);
  console.log(`Trips ${args.apply ? 'cancelled' : 'would cancel'}: ${args.apply ? result.tripsCancelled : result.tripsWouldCancel}`);

  for (const row of result.details.slice(0, 50)) {
    console.log(`  sub ${row.subscriptionId} (${row.status}): ${row.tripIds.length} trip(s)`);
  }
  if (result.details.length > 50) {
    console.log(`  … and ${result.details.length - 50} more subscriptions`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
