# Load Testing

Covers the SLOs, tool setup, how to run the load tests, and important caveats for the 1000-concurrent-user scenario.

---

## Tool

**k6** (https://k6.io) — an open-source load testing tool written in Go. Scripts are JavaScript.

### Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows (winget)
winget install k6 --source winget
```

---

## SLOs

| Endpoint category | p95 target | Error rate target |
|---|---|---|
| Public reads (packages, add-ons) | < 500 ms | < 1% |
| Authenticated reads (subscriptions, trips) | < 500 ms | < 1% |
| Admin CRUD | < 800 ms | < 1% |
| ORS quote (distance + pricing) | < 1 000 ms | < 1% |
| GPS location update | < 300 ms | < 1% |
| Payment initiation | < 2 000 ms | < 0.5% |

---

## Scripts

### Smoke test (5 VUs, 30 seconds)

```bash
npm run load:smoke
# or directly:
k6 run load-tests/fizza-smoke.js
```

Used to verify the staging environment is healthy and API contracts are correct before running the full 1000-user test.

### 1000-user ramp (full load)

```bash
npm run load:1000
# or directly:
k6 run load-tests/fizza-1000-users.js
```

Ramp pattern:
- 0 → 200 VUs over 1 minute (warm-up)
- 200 → 1000 VUs over 3 minutes (ramp-up)
- Hold 1000 VUs for 5 minutes (sustained load)
- 1000 → 0 VUs over 1 minute (ramp-down)

---

## Environment Setup for Load Tests

The scripts read base URL and auth tokens from environment variables:

```bash
# Required
export LOAD_TEST_BASE_URL=https://your-staging-domain.com

# Optional: pre-authenticated JWT tokens for protected endpoint tests
# Generate from your staging login endpoint
export LOAD_TEST_RIDER_TOKEN=eyJhbGci...
export LOAD_TEST_DRIVER_TOKEN=eyJhbGci...
export LOAD_TEST_ADMIN_TOKEN=eyJhbGci...
```

Or pass inline:

```bash
k6 run -e BASE_URL=https://staging.fizza.sa load-tests/fizza-1000-users.js
```

---

## ⚠️ ORS Rate Limit Warning

The OpenRouteService free tier allows **~2 000 requests/day**. The 1000-user load test script does NOT call ORS directly — it uses mocked or cached distance endpoints in the test scenario. Running the full ORS quote endpoint at 1000 VUs would exhaust the daily quota in seconds and cause the test to fail with `503 NOT_CONFIGURED` errors.

**What the load test covers for ORS**:
- The GET `/api/subscription-packages` and `/api/add-ons` endpoints at full load.
- The POST `/api/subscriptions` endpoint is tested at a lower rate (10 VUs) to stay within ORS limits.
- If you have an ORS paid plan, remove the VU cap on the subscription creation scenario.

---

## Interpreting Results

k6 outputs a summary after each run. Key metrics to check:

```
✓ http_req_duration p(95) ..... must be below SLO threshold
✓ http_req_failed ............. rate < 0.01 (1%)
✓ checks ...................... pass rate > 99%
```

If p95 exceeds the SLO:
1. Check Vercel function cold start times (first request spike).
2. Check MySQL slow query log — missing indexes are the most common cause.
3. Verify connection pooling is configured (see `docs/database-setup.md`).

---

## Status

| Step | Status |
|---|---|
| k6 scripts written | ✅ Done |
| Smoke test against local dev | ⚠️ BLOCKED — local dev has no ORS key or payment gateway |
| Smoke test against staging | ⚠️ BLOCKED — staging environment not yet provisioned |
| 1000-user test against staging | ⚠️ BLOCKED — staging environment not yet provisioned |
