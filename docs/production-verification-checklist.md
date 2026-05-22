# Production Verification Checklist

Step-by-step end-to-end test flow to run before and after production launch. Complete each section in order.

---

## 0. Pre-Flight

- [ ] `npm run verify` passes locally (build + typecheck + lint + audit + tests)
- [ ] All environment variables set in Vercel (see `docs/environment.md`)
- [ ] Hosted MySQL provisioned and migrations applied (`npx prisma migrate deploy`)
- [ ] Database seeded (`npx prisma db seed`)
- [ ] Deployment successful (Vercel build logs show no errors)

---

## 1. Authentication

### 1.1 Register a new rider
- [ ] POST `/api/auth/register` with name, email, password
- [ ] Response: `201` with user object, no password in response
- [ ] JWT cookie set in browser

### 1.2 Login
- [ ] POST `/api/auth/login` with valid credentials
- [ ] Response: `200` with user object
- [ ] JWT cookie set

### 1.3 Invalid login
- [ ] POST `/api/auth/login` with wrong password
- [ ] Response: `401` — not `500`

### 1.4 Protected route without auth
- [ ] GET `/api/subscriptions` with no cookie
- [ ] Response: `401`

---

## 2. Subscription Packages and Add-ons (Public)

### 2.1 List packages
- [ ] GET `/api/subscription-packages`
- [ ] Response: `200` with array of active packages
- [ ] `Cache-Control: private, max-age=60` header present

### 2.2 List add-ons
- [ ] GET `/api/add-ons`
- [ ] Response: `200` with array of active add-ons
- [ ] `Cache-Control: private, max-age=60` header present

---

## 3. Subscription Creation (Rider)

### 3.1 Get a distance quote
- [ ] POST `/api/distance/quote` with valid origin and destination addresses
- [ ] Response: `200` with `distanceKm` and `priceSar`
- [ ] If ORS key missing: `503` with `NOT_CONFIGURED` code (not a 500)

### 3.2 Create a subscription
- [ ] POST `/api/subscriptions` with:
  - `packageId` (from step 2.1)
  - `riderId` (a rider belonging to the authenticated user)
  - `originAddress`, `destinationAddress`
  - Optionally `addOnIds`
- [ ] Response: `201` with subscription object including `finalPriceSar`
- [ ] `finalPriceSar` matches expected package price + add-on prices
- [ ] `paymentStatus` is `PENDING`

---

## 4. Payment

### 4.1 Initiate MyFatoorah payment
- [ ] POST `/api/payments/create` with `subscriptionId`
- [ ] Response: `200` with `paymentUrl`
- [ ] `paymentUrl` redirects to MyFatoorah checkout page (test mode)

### 4.2 Complete payment (test mode)
- [ ] Use MyFatoorah test card to complete payment
- [ ] Webhook received at `POST /api/payments/webhook`
- [ ] Subscription `paymentStatus` updated to `PAID`
- [ ] Rider receives a notification

### 4.3 Payment amount is snapshot-based
- [ ] Admin changes the package price
- [ ] Attempt payment again on the old subscription
- [ ] Confirm: payment amount is still the original `finalPriceSar`, not the new price

### 4.4 Wallet payment (if wallet balance sufficient)
- [ ] POST `/api/wallet/pay-subscription` with `subscriptionId`
- [ ] Response: `200` if wallet has sufficient balance
- [ ] Subscription `paymentStatus` updated to `PAID`

---

## 5. Trip Management

### 5.1 Generate trip schedule
- [ ] POST `/api/subscriptions/[id]/generate-trips` (or confirm auto-generated on PAID)
- [ ] Trips created for the subscription

### 5.2 List trips (rider)
- [ ] GET `/api/trips?subscriptionId=[id]`
- [ ] Response: `200` with trip array
- [ ] Only the authenticated rider's trips returned

### 5.3 Driver assignment (admin)
- [ ] PATCH `/api/admin/trips/[id]` to assign a driver
- [ ] Trip status updates to `DRIVER_ASSIGNED`
- [ ] Driver receives notification

### 5.4 GPS location update (driver)
- [ ] POST `/api/tracking/[tripId]/location` with `lat`, `lng` as authenticated driver
- [ ] Response: `201` with location object
- [ ] Second request within 5 seconds: `429` (throttle working)
- [ ] Request after 5 seconds: `201` again

### 5.5 GPS location read (rider tracking)
- [ ] GET `/api/tracking/[tripId]` as authenticated rider
- [ ] Response: `200` with latest driver location

---

## 6. Admin Panel

### 6.1 Admin login
- [ ] Login as admin (`admin@fizza.sa` / seeded password)
- [ ] Navigate to `/admin`
- [ ] All sections visible: Subscriptions, Trips, Drivers, Packages & Add-ons, Users

### 6.2 Package management
- [ ] Create a new subscription package via Packages & Add-ons section
- [ ] Package appears in GET `/api/subscription-packages`
- [ ] Edit the package price
- [ ] Deactivate a package that has subscriptions — confirm "deactivated" message (not deleted)

### 6.3 Add-on management
- [ ] Create a new add-on
- [ ] Edit the add-on
- [ ] Delete an add-on with no subscriptions — confirm hard delete

### 6.4 Admin-created subscription
- [ ] POST `/api/admin/subscriptions` with `userId` of a non-admin user
- [ ] Subscription created under the target user
- [ ] Target user receives notification
- [ ] AuditLog entry with `ADMIN_SUBSCRIPTION_CREATED`

### 6.5 Audit log
- [ ] GET `/api/admin/audit-logs`
- [ ] All admin actions from steps 6.2–6.4 visible

---

## 7. Safety Reports

### 7.1 Submit a safety report
- [ ] POST `/api/safety/report` with `tripId` and incident details
- [ ] Response: `201`
- [ ] Report visible to admin

---

## 8. Notifications

### 8.1 List notifications
- [ ] GET `/api/notifications`
- [ ] Notifications from payment confirmation and driver assignment present
- [ ] `isRead: false` for new notifications

### 8.2 Mark as read
- [ ] PATCH `/api/notifications/[id]/read`
- [ ] `isRead` becomes `true`

---

## 9. Error Handling

- [ ] Invalid UUID in any `[id]` route: `400` or `404` (not `500`)
- [ ] Malformed JSON body: `400` (not `500`)
- [ ] Missing required field: `400` with descriptive message (not `500`)
- [ ] Unauthenticated request to protected route: `401` (not `500`)
- [ ] Non-admin request to admin route: `403` (not `500`)

---

## 10. Post-Launch

- [ ] Monitor Vercel function error rate for 24 hours — target < 1%
- [ ] Monitor MySQL slow query log — all queries < 500 ms
- [ ] Verify MyFatoorah webhook delivery success rate in merchant portal
- [ ] Run smoke load test against production: `k6 run load-tests/fizza-smoke.js`
