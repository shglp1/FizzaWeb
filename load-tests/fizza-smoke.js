/**
 * FizzaWeb — k6 Smoke Test
 *
 * Purpose: Verify the staging environment is healthy and API contracts are
 * correct before running the full 1000-user load test.
 *
 * Load profile: 5 VUs, 30 seconds
 * Usage:
 *   k6 run load-tests/fizza-smoke.js
 *   k6 run -e BASE_URL=https://staging.fizza.sa load-tests/fizza-smoke.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────
const errorRate = new Rate('errors');
const packagesDuration = new Trend('packages_duration', true);
const addOnsDuration = new Trend('addons_duration', true);

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    // Smoke: generous thresholds to catch obvious failures
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

// ── Scenarios ─────────────────────────────────────────────────────────────────

export default function () {
  // 1. Public packages endpoint
  {
    const res = http.get(`${BASE_URL}/api/subscription-packages`);
    packagesDuration.add(res.timings.duration);
    const ok = check(res, {
      'packages: status 200': (r) => r.status === 200,
      'packages: has data array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data);
        } catch {
          return false;
        }
      },
      'packages: cache-control header present': (r) =>
        r.headers['Cache-Control'] !== undefined,
    });
    errorRate.add(!ok);
  }

  sleep(0.5);

  // 2. Public add-ons endpoint
  {
    const res = http.get(`${BASE_URL}/api/add-ons`);
    addOnsDuration.add(res.timings.duration);
    const ok = check(res, {
      'add-ons: status 200': (r) => r.status === 200,
      'add-ons: has data array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data);
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  }

  sleep(0.5);

  // 3. Unauthenticated request to protected endpoint should return 401
  {
    const res = http.get(`${BASE_URL}/api/subscriptions`);
    const ok = check(res, {
      'subscriptions (no auth): status 401': (r) => r.status === 401,
    });
    errorRate.add(!ok);
  }

  sleep(0.5);

  // 4. Invalid route returns 404 or 405 (not 500)
  {
    const res = http.get(`${BASE_URL}/api/nonexistent-route-smoke-test`);
    const ok = check(res, {
      'unknown route: not 500': (r) => r.status !== 500,
    });
    errorRate.add(!ok);
  }

  sleep(1);
}

export function handleSummary(data) {
  // Print pass/fail for each threshold
  const thresholds = data.metrics;
  console.log('\n=== Smoke Test Summary ===');
  console.log(`VUs: 5 | Duration: 30s`);

  const p95 = thresholds.http_req_duration?.values?.['p(95)'];
  const errorRateVal = thresholds.http_req_failed?.values?.rate;

  console.log(`p95 latency:  ${p95 ? p95.toFixed(0) + 'ms' : 'N/A'}`);
  console.log(`Error rate:   ${errorRateVal ? (errorRateVal * 100).toFixed(2) + '%' : 'N/A'}`);

  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
