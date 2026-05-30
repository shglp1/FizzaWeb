/**
 * FizzaWeb — k6 1000-User Load Test
 *
 * Tests the system under sustained load of 1000 concurrent virtual users.
 *
 * Load profile:
 *   Stage 1: 0 → 200 VUs over 1 minute  (warm-up)
 *   Stage 2: 200 → 1000 VUs over 3 minutes  (ramp-up)
 *   Stage 3: Hold 1000 VUs for 5 minutes  (sustained load)
 *   Stage 4: 1000 → 0 VUs over 1 minute  (ramp-down)
 *
 * SLOs (must pass for green):
 *   Public reads (packages, add-ons):  p95 < 500ms
 *   GPS updates:                        p95 < 300ms
 *   Subscription creation:             p95 < 1000ms  (limited to 10 VUs — ORS quota)
 *   Admin reads:                        p95 < 800ms
 *   Error rate:                         < 1%
 *
 * ⚠️  ORS WARNING: Subscription creation calls OpenRouteService.
 *     The free ORS tier allows ~2000 requests/day.
 *     The subscription scenario is intentionally limited to 10 VUs.
 *     Remove the VU cap if you have a paid ORS plan.
 *
 * Usage:
 *   k6 run load-tests/fizza-1000-users.js
 *   k6 run \
 *     -e BASE_URL=https://staging.fizza.sa \
 *     -e RIDER_TOKEN=eyJhbGci... \
 *     -e DRIVER_TOKEN=eyJhbGci... \
 *     -e ADMIN_TOKEN=eyJhbGci... \
 *     load-tests/fizza-1000-users.js
 *
 * Generate tokens:
 *   curl -s -X POST https://staging.fizza.sa/api/auth/login \
 *     -H 'Content-Type: application/json' \
 *     -d '{"email":"rider@test.sa","password":"Test1234!"}' \
 *     | jq -r '.token'  # adjust for your auth response shape
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate = new Rate('errors');
const packagesDuration = new Trend('packages_p95', true);
const addOnsDuration = new Trend('addons_p95', true);
const gpsDuration = new Trend('gps_update_p95', true);
const subscriptionDuration = new Trend('subscription_creation_p95', true);
const adminDuration = new Trend('admin_read_p95', true);
// ── Performance-audit additions (Phase 1 baseline) ────────────────────────────
const parentTripsDuration = new Trend('parent_trips_p95', true);
const walletDuration = new Trend('wallet_p95', true);
const adminTripsDuration = new Trend('admin_trips_p95', true);
const adminLiveDuration = new Trend('admin_live_p95', true);
const adminFinancialsDuration = new Trend('admin_financials_p95', true);
const adminUsersDuration = new Trend('admin_users_p95', true);

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const RIDER_TOKEN = __ENV.RIDER_TOKEN || '';
const DRIVER_TOKEN = __ENV.DRIVER_TOKEN || '';
const ADMIN_TOKEN = __ENV.ADMIN_TOKEN || '';

// Sample trip IDs from your seeded data — replace with real IDs from your DB
const SAMPLE_TRIP_IDS = (__ENV.TRIP_IDS || 'trip-id-placeholder-1,trip-id-placeholder-2').split(',');

// ── Options ───────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Scenario A: Public endpoint reads (packages + add-ons)
    // 1000 VUs — the dominant load, these must scale
    public_reads: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 },
        { duration: '3m', target: 1000 },
        { duration: '5m', target: 1000 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      exec: 'publicReads',
    },

    // Scenario B: GPS location updates (drivers sending location)
    // 50 VUs — typically fewer active drivers than riders
    gps_updates: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
      gracefulStop: '30s',
      exec: 'gpsUpdates',
      startTime: '1m', // start after warm-up
    },

    // Scenario C: Authenticated rider reads (subscriptions list)
    // 200 VUs — authenticated reads under load
    authenticated_reads: {
      executor: 'constant-vus',
      vus: 200,
      duration: '8m',
      gracefulStop: '30s',
      exec: 'authenticatedReads',
      startTime: '1m',
    },

    // Scenario D: Subscription creation (hits ORS — rate-limited!)
    // ⚠️ Capped at 10 VUs to protect ORS free-tier quota.
    // One request per 6s per VU = ~100 ORS calls/minute = ~1000/10min
    // Upgrade ORS plan and increase VUs for real load testing.
    subscription_creation: {
      executor: 'constant-vus',
      vus: 10,
      duration: '8m',
      gracefulStop: '30s',
      exec: 'subscriptionCreation',
      startTime: '2m',
    },

    // Scenario E: Admin reads (audit logs, subscription list)
    // 5 VUs — admin users are few
    admin_reads: {
      executor: 'constant-vus',
      vus: 5,
      duration: '8m',
      gracefulStop: '30s',
      exec: 'adminReads',
      startTime: '2m',
    },
  },

  thresholds: {
    // Global
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],

    // Public reads — tightest SLO
    'http_req_duration{scenario:public_reads}': ['p(95)<500'],

    // GPS — tight because it must be real-time
    'http_req_duration{scenario:gps_updates}': ['p(95)<300'],

    // Authenticated reads
    'http_req_duration{scenario:authenticated_reads}': ['p(95)<500'],

    // Subscription creation — ORS adds latency
    'http_req_duration{scenario:subscription_creation}': ['p(95)<1000'],

    // Admin — can be slower
    'http_req_duration{scenario:admin_reads}': ['p(95)<800'],

    // ── Performance-audit SLOs (Phase 1 baseline targets) ───────────────────
    'parent_trips_p95': ['p(95)<500'],
    'wallet_p95': ['p(95)<400'],
    'admin_trips_p95': ['p(95)<800'],
    'admin_live_p95': ['p(95)<1000'],
    'admin_financials_p95': ['p(95)<1500'],
    'admin_users_p95': ['p(95)<800'],
  },
};

// ── Auth helpers ──────────────────────────────────────────────────────────────
function riderHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(RIDER_TOKEN ? { Cookie: `session=${RIDER_TOKEN}` } : {}),
  };
}

function driverHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(DRIVER_TOKEN ? { Cookie: `session=${DRIVER_TOKEN}` } : {}),
  };
}

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    ...(ADMIN_TOKEN ? { Cookie: `session=${ADMIN_TOKEN}` } : {}),
  };
}

// ── Scenario A: Public reads ──────────────────────────────────────────────────
export function publicReads() {
  group('public reads', () => {
    // Packages
    {
      const res = http.get(`${BASE_URL}/api/subscription-packages`);
      packagesDuration.add(res.timings.duration);
      const ok = check(res, {
        'packages: 200': (r) => r.status === 200,
        'packages: data array': (r) => {
          try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; }
        },
      });
      errorRate.add(!ok);
    }

    sleep(1 + Math.random() * 2); // 1–3s think time

    // Add-ons
    {
      const res = http.get(`${BASE_URL}/api/add-ons`);
      addOnsDuration.add(res.timings.duration);
      const ok = check(res, {
        'add-ons: 200': (r) => r.status === 200,
        'add-ons: data array': (r) => {
          try { return Array.isArray(JSON.parse(r.body).data); } catch { return false; }
        },
      });
      errorRate.add(!ok);
    }

    sleep(2 + Math.random() * 3); // 2–5s think time
  });
}

// ── Scenario B: GPS updates ───────────────────────────────────────────────────
export function gpsUpdates() {
  if (!DRIVER_TOKEN) {
    // Skip if no token configured; log a warning every 10th iteration
    if (Math.random() < 0.1) {
      console.warn('[gpsUpdates] No DRIVER_TOKEN set — skipping authenticated GPS test');
    }
    sleep(6);
    return;
  }

  group('gps update', () => {
    const tripId = SAMPLE_TRIP_IDS[Math.floor(Math.random() * SAMPLE_TRIP_IDS.length)];

    // Slight jitter on coordinates to simulate movement
    const lat = 24.7136 + (Math.random() - 0.5) * 0.01;
    const lng = 46.6753 + (Math.random() - 0.5) * 0.01;

    const res = http.post(
      `${BASE_URL}/api/tracking/${tripId}/location`,
      JSON.stringify({ lat, lng }),
      { headers: driverHeaders() },
    );

    gpsDuration.add(res.timings.duration);

    const ok = check(res, {
      'gps: 201 created or 429 throttled': (r) => r.status === 201 || r.status === 429,
      'gps: not 500': (r) => r.status !== 500,
    });
    errorRate.add(!ok);
  });

  sleep(6); // Respect 5s throttle + 1s buffer
}

// ── Scenario C: Authenticated reads ──────────────────────────────────────────
export function authenticatedReads() {
  if (!RIDER_TOKEN) {
    if (Math.random() < 0.1) {
      console.warn('[authenticatedReads] No RIDER_TOKEN set — testing 401 response');
    }
    // Verify unauthenticated request returns 401
    const res = http.get(`${BASE_URL}/api/subscriptions`, { headers: { 'Content-Type': 'application/json' } });
    check(res, { 'no auth: 401': (r) => r.status === 401 });
    sleep(3 + Math.random() * 4);
    return;
  }

  group('authenticated reads', () => {
    // Subscriptions list
    {
      const res = http.get(`${BASE_URL}/api/subscriptions`, { headers: riderHeaders() });
      const ok = check(res, {
        'subscriptions: 200': (r) => r.status === 200,
        'subscriptions: has data': (r) => {
          try { return JSON.parse(r.body).data !== undefined; } catch { return false; }
        },
      });
      errorRate.add(!ok);
    }

    sleep(1 + Math.random() * 2);

    // Parent trips list (paginated, upcoming filter)
    {
      const res = http.get(`${BASE_URL}/api/trips?status=upcoming&limit=50`, { headers: riderHeaders() });
      parentTripsDuration.add(res.timings.duration);
      const ok = check(res, {
        'trips: 200': (r) => r.status === 200,
        'trips: not 500': (r) => r.status !== 500,
      });
      errorRate.add(!ok);
    }

    sleep(1 + Math.random() * 2);

    // Wallet (balance + recent transactions)
    {
      const res = http.get(`${BASE_URL}/api/wallet`, { headers: riderHeaders() });
      walletDuration.add(res.timings.duration);
      const ok = check(res, {
        'wallet: 200': (r) => r.status === 200,
        'wallet: not 500': (r) => r.status !== 500,
      });
      errorRate.add(!ok);
    }
  });

  sleep(3 + Math.random() * 4); // 3–7s think time
}

// ── Scenario D: Subscription creation (ORS-limited) ──────────────────────────
// ⚠️ Each iteration calls ORS. Keep VU count low on free tier.
export function subscriptionCreation() {
  if (!RIDER_TOKEN) {
    if (Math.random() < 0.1) {
      console.warn('[subscriptionCreation] No RIDER_TOKEN set — skipping');
    }
    sleep(10);
    return;
  }

  group('subscription creation', () => {
    // First, get a distance quote
    const quoteRes = http.post(
      `${BASE_URL}/api/distance/quote`,
      JSON.stringify({
        originAddress: 'King Fahd Road, Riyadh, Saudi Arabia',
        destinationAddress: 'King Abdullah Financial District, Riyadh, Saudi Arabia',
      }),
      { headers: riderHeaders() },
    );

    const quoteOk = check(quoteRes, {
      'quote: 200 or 503 (no ORS key)': (r) => r.status === 200 || r.status === 503,
      'quote: not 500': (r) => r.status !== 500,
    });

    subscriptionDuration.add(quoteRes.timings.duration);

    if (!quoteOk || quoteRes.status !== 200) {
      sleep(6);
      return;
    }

    // Note: full subscription creation (POST /api/subscriptions) requires
    // a valid packageId and riderId from your seeded data.
    // Uncomment and configure with real IDs from your staging DB:
    //
    // const createRes = http.post(
    //   `${BASE_URL}/api/subscriptions`,
    //   JSON.stringify({
    //     packageId: 'your-seeded-package-id',
    //     riderId: 'your-seeded-rider-id',
    //     originAddress: 'King Fahd Road, Riyadh',
    //     destinationAddress: 'King Abdullah Financial District, Riyadh',
    //   }),
    //   { headers: riderHeaders() },
    // );
    // check(createRes, { 'subscription: 201': (r) => r.status === 201 });
    // subscriptionDuration.add(createRes.timings.duration);
  });

  sleep(6 + Math.random() * 4); // 6–10s between ORS calls
}

// ── Scenario E: Admin reads ───────────────────────────────────────────────────
export function adminReads() {
  if (!ADMIN_TOKEN) {
    if (Math.random() < 0.1) {
      console.warn('[adminReads] No ADMIN_TOKEN set — testing 401 response');
    }
    const res = http.get(`${BASE_URL}/api/admin/subscriptions`, { headers: { 'Content-Type': 'application/json' } });
    check(res, { 'admin no auth: 401': (r) => r.status === 401 });
    sleep(5);
    return;
  }

  group('admin reads', () => {
    // List subscriptions
    {
      const res = http.get(`${BASE_URL}/api/admin/subscriptions`, { headers: adminHeaders() });
      adminDuration.add(res.timings.duration);
      const ok = check(res, {
        'admin subscriptions: 200': (r) => r.status === 200,
        'admin subscriptions: not 500': (r) => r.status !== 500,
      });
      errorRate.add(!ok);
    }

    sleep(2);

    // List packages (admin view with inactive)
    {
      const res = http.get(`${BASE_URL}/api/admin/subscription-packages`, { headers: adminHeaders() });
      adminDuration.add(res.timings.duration);
      const ok = check(res, {
        'admin packages: 200': (r) => r.status === 200,
        'admin packages: not 500': (r) => r.status !== 500,
      });
      errorRate.add(!ok);
    }

    sleep(2);

    // Admin trips list (paginated)
    {
      const res = http.get(`${BASE_URL}/api/admin/trips?limit=50`, { headers: adminHeaders() });
      adminTripsDuration.add(res.timings.duration);
      const ok = check(res, {
        'admin trips: 200': (r) => r.status === 200,
        'admin trips: not 500': (r) => r.status !== 500,
      });
      errorRate.add(!ok);
    }

    sleep(2);

    // Admin live operations monitor (active trips + GPS freshness)
    {
      const res = http.get(`${BASE_URL}/api/admin/trips/live`, { headers: adminHeaders() });
      adminLiveDuration.add(res.timings.duration);
      const ok = check(res, {
        'admin live: 200': (r) => r.status === 200,
        'admin live: not 500': (r) => r.status !== 500,
      });
      errorRate.add(!ok);
    }

    sleep(2);

    // Admin financial overview (aggregates)
    {
      const res = http.get(`${BASE_URL}/api/admin/financials/overview`, { headers: adminHeaders() });
      adminFinancialsDuration.add(res.timings.duration);
      const ok = check(res, {
        'admin financials: 200': (r) => r.status === 200,
        'admin financials: not 500': (r) => r.status !== 500,
      });
      errorRate.add(!ok);
    }

    sleep(2);

    // Admin users list (paginated + summary counts)
    {
      const res = http.get(`${BASE_URL}/api/admin/users?limit=25`, { headers: adminHeaders() });
      adminUsersDuration.add(res.timings.duration);
      const ok = check(res, {
        'admin users: 200': (r) => r.status === 200,
        'admin users: not 500': (r) => r.status !== 500,
      });
      errorRate.add(!ok);
    }
  });

  sleep(5 + Math.random() * 5); // 5–10s think time
}

// ── Summary handler ───────────────────────────────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics;

  function p95(metric) {
    return m[metric]?.values?.['p(95)']?.toFixed(0) + 'ms' ?? 'N/A';
  }

  function rate(metric) {
    const v = m[metric]?.values?.rate;
    return v !== undefined ? (v * 100).toFixed(2) + '%' : 'N/A';
  }

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     FizzaWeb 1000-User Load Test Report  ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  p95 public reads:           ${p95('http_req_duration').padEnd(12)} ║`);
  console.log(`║  p95 GPS updates:            ${p95('gps_update_p95').padEnd(12)} ║`);
  console.log(`║  p95 subscription creation:  ${p95('subscription_creation_p95').padEnd(12)} ║`);
  console.log(`║  p95 admin reads:            ${p95('admin_read_p95').padEnd(12)} ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  p95 parent trips:           ${p95('parent_trips_p95').padEnd(12)} ║`);
  console.log(`║  p95 wallet:                 ${p95('wallet_p95').padEnd(12)} ║`);
  console.log(`║  p95 admin trips:            ${p95('admin_trips_p95').padEnd(12)} ║`);
  console.log(`║  p95 admin live ops:         ${p95('admin_live_p95').padEnd(12)} ║`);
  console.log(`║  p95 admin financials:       ${p95('admin_financials_p95').padEnd(12)} ║`);
  console.log(`║  p95 admin users:            ${p95('admin_users_p95').padEnd(12)} ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  HTTP error rate:            ${rate('http_req_failed').padEnd(12)} ║`);
  console.log(`║  Custom error rate:          ${rate('errors').padEnd(12)} ║`);
  console.log('╚══════════════════════════════════════════╝\n');

  return {
    'load-tests/results/1000-users-summary.json': JSON.stringify(data, null, 2),
    stdout: '',
  };
}
