/**
 * Seed script — run with: npx prisma db seed
 *
 * Idempotent: skips creation if records already exist.
 *
 * Creates:
 *   - 3 subscription packages (Monthly / Term / Annual)
 *   - 3 add-ons (GPS, Female Driver, Emergency Contact)
 *
 * Admin user setup: register via the app, then promote in MySQL:
 *   UPDATE users SET role = 'ADMIN' WHERE email = 'admin@fizza.sa';
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPackages() {
  const existing = await prisma.subscriptionPackage.count();
  if (existing > 0) {
    console.log(`Subscription packages already seeded (${existing} found), skipping.`);
    return;
  }

  await prisma.subscriptionPackage.createMany({
    data: [
      {
        name: 'Monthly Plan',
        billingCycle: 'monthly',
        priceSar: 299,
        description: 'Flexible monthly school transport subscription.',
      },
      {
        name: 'Term Plan',
        billingCycle: 'term',
        priceSar: 799,
        description: 'One academic term (~3 months) at a discounted rate.',
      },
      {
        name: 'Annual Plan',
        billingCycle: 'annual',
        priceSar: 2499,
        description: 'Full academic year — best value, roughly 2 months free.',
      },
    ],
  });

  console.log('Created 3 subscription packages.');
}

async function seedAddOns() {
  const existing = await prisma.addOn.count();
  if (existing > 0) {
    console.log(`Add-ons already seeded (${existing} found), skipping.`);
    return;
  }

  await prisma.addOn.createMany({
    data: [
      { name: 'Live GPS Tracking', priceSar: 29 },
      { name: 'Female Driver Preference', priceSar: 49 },
      { name: 'Emergency Contact Notifications', priceSar: 19 },
    ],
  });

  console.log('Created 3 add-ons.');
}

async function main() {
  await seedPackages();
  await seedAddOns();

  console.log('');
  console.log('Seed complete.');
  console.log('');
  console.log('To create an admin user:');
  console.log('  1. Register via POST /api/auth/register');
  console.log("  2. Run in MySQL: UPDATE users SET role = 'ADMIN' WHERE email = 'your@email.sa';");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
