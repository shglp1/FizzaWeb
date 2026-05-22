# Environment Variables

This document covers every environment variable used by FizzaWeb, how to set them up for each environment, and which variables are safe to expose publicly vs. which must be kept private.

---

## Quick Reference

| Variable | Required | Public? | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ❌ | MySQL connection string |
| `SESSION_SECRET` | ✅ | ❌ | JWT signing secret (≥32 chars) |
| `APP_URL` | ✅ | ❌ server-side only | Base URL for payment callbacks |
| `OPENROUTESERVICE_API_KEY` | ✅ | ❌ | ORS routing/geocoding key |
| `DISTANCE_PROVIDER` | ✅ | ❌ | `OPENROUTESERVICE` (only supported) |
| `MYFATOORAH_API_KEY` | ✅ | ❌ | MyFatoorah payment gateway key |
| `MYFATOORAH_BASE_URL` | ✅ | ❌ | MyFatoorah API base URL |
| `MYFATOORAH_WEBHOOK_SECRET` | ✅ | ❌ | Webhook HMAC secret |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | ⚠️ optional | ✅ | Mapbox map display token |
| `STORAGE_DRIVER` | ⚠️ optional | ❌ | File storage driver |
| `UPLOAD_MAX_SIZE_MB` | ⚠️ optional | ❌ | Max upload size in MB |

---

## Variable Details

### `DATABASE_URL`
- **Required**: Yes
- **Format**: `mysql://USER:PASSWORD@HOST:PORT/DATABASE`
- **Notes**: Must be a **hosted** MySQL database for Vercel/serverless deployments. `localhost` MySQL will not work on Vercel.
- **Example** (Railway): `mysql://root:abc123@containers-us-west-1.railway.app:6543/fizzaweb`

### `SESSION_SECRET`
- **Required**: Yes
- **Format**: Random string ≥ 32 characters
- **Generate**: `openssl rand -base64 32`
- **Notes**: Used to sign JWT session tokens. Changing this invalidates all existing sessions.

### `APP_URL`
- **Required**: Yes
- **Format**: `https://your-domain.com` (no trailing slash)
- **Notes**: Used to construct MyFatoorah payment callback URLs and webhook verification. Must match the deployed domain exactly.
- **Local dev**: `http://localhost:3000`

### `OPENROUTESERVICE_API_KEY`
- **Required**: Yes (distance calculation fails gracefully with error if missing)
- **Notes**: Server-side only. Never prefix with `NEXT_PUBLIC_`. Free tier: ~2,000 requests/day. See ORS dashboard: https://openrouteservice.org/dev/#/home
- **Failure mode**: Returns `503` with `NOT_CONFIGURED` code — subscription creation still fails but with a clear error.

### `DISTANCE_PROVIDER`
- **Required**: Yes
- **Value**: `OPENROUTESERVICE`
- **Notes**: Only `OPENROUTESERVICE` is implemented. `GOOGLE_MAPS` and `MAPBOX` return `PROVIDER_NOT_IMPLEMENTED`.

### `MYFATOORAH_API_KEY`
- **Required**: Yes
- **Notes**: Server-side only. Use the **test key** for staging, **production key** for production. Obtain from MyFatoorah merchant portal.
- **Test base URL**: `https://apitest.myfatoorah.com`
- **Production base URL**: `https://api.myfatoorah.com`

### `MYFATOORAH_BASE_URL`
- **Required**: Yes
- **Values**: `https://apitest.myfatoorah.com` (test) or `https://api.myfatoorah.com` (production)

### `MYFATOORAH_WEBHOOK_SECRET`
- **Required**: Yes
- **Notes**: Used to verify the HMAC signature of incoming webhooks from MyFatoorah. Set in MyFatoorah merchant portal under webhook settings. The webhook endpoint is `https://YOUR_DOMAIN/api/payments/webhook`.

### `NEXT_PUBLIC_MAPBOX_TOKEN`
- **Required**: No (map display is optional)
- **Public**: Yes — this is the only variable that can be prefixed `NEXT_PUBLIC_`.
- **Notes**: Used only for client-side map rendering in the tracking page. Restrict the token in Mapbox dashboard to your domain.

### `STORAGE_DRIVER`
- **Required**: No
- **Values**: `local` | `s3` (future)
- **Notes**: File upload driver. Currently only URLs are stored. Full upload implementation pending.

### `UPLOAD_MAX_SIZE_MB`
- **Required**: No
- **Default**: `10`
- **Notes**: Maximum allowed file upload size in megabytes.

---

## `.env.example`

```env
# ── Database ───────────────────────────────────────────────────────────────────
DATABASE_URL=mysql://USER:PASSWORD@HOST:PORT/DATABASE

# ── Auth ──────────────────────────────────────────────────────────────────────
SESSION_SECRET=replace-with-32-or-more-random-characters

# ── App ───────────────────────────────────────────────────────────────────────
APP_URL=https://your-domain.com

# ── Distance provider ──────────────────────────────────────────────────────────
DISTANCE_PROVIDER=OPENROUTESERVICE
OPENROUTESERVICE_API_KEY=your-ors-api-key-here

# ── Payments (MyFatoorah) ─────────────────────────────────────────────────────
MYFATOORAH_API_KEY=your-myfatoorah-api-key
MYFATOORAH_BASE_URL=https://apitest.myfatoorah.com
MYFATOORAH_WEBHOOK_SECRET=your-webhook-secret

# ── Public (safe to expose) ───────────────────────────────────────────────────
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-public-token

# ── Storage ───────────────────────────────────────────────────────────────────
STORAGE_DRIVER=local
UPLOAD_MAX_SIZE_MB=10
```

---

## Local Development Setup

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```
2. Fill in `DATABASE_URL` pointing to your local MySQL instance.
3. Set `APP_URL=http://localhost:3000`.
4. Use your ORS test API key and MyFatoorah test key.
5. Run:
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   npm run dev
   ```

---

## Staging Setup

- Use a hosted MySQL database (Railway, PlanetScale, Aiven — see `docs/database-setup.md`).
- Set `APP_URL` to the staging domain.
- Use MyFatoorah test credentials (`https://apitest.myfatoorah.com`).
- Set `SESSION_SECRET` to a strong random value (different from production).

---

## Production Setup

- Use a production-grade hosted MySQL (DigitalOcean Managed MySQL, AWS RDS, Aiven).
- Set `APP_URL` to the production domain.
- Use MyFatoorah **production** credentials (`https://api.myfatoorah.com`).
- Generate a new `SESSION_SECRET` — do not reuse staging value.
- Restrict `NEXT_PUBLIC_MAPBOX_TOKEN` to the production domain in Mapbox dashboard.

---

## Vercel Environment Variable Setup

1. In Vercel project settings → **Environment Variables**.
2. Add each variable under **Production**, **Preview**, and/or **Development** as needed.
3. Mark `NEXT_PUBLIC_MAPBOX_TOKEN` as available to all environments.
4. All other variables must be **server-side only** (do not check "Expose to browser").
5. After adding variables, **redeploy** the project.

---

## Security Rules

> ⚠️ **Never commit real credentials to git.**

- `.env` is in `.gitignore` — never commit it.
- Only `.env.example` (with placeholders) should be committed.
- No Supabase variables remain in this project.
- `OPENROUTESERVICE_API_KEY` and `MYFATOORAH_API_KEY` are **server-side only** — they are never sent to the browser.
- Client-side code must only read `NEXT_PUBLIC_*` variables.
- If a variable is missing in production, the relevant feature fails with a clear error — the app does not crash silently.
