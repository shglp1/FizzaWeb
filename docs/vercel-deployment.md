# Vercel Deployment Guide

Step-by-step guide for deploying FizzaWeb to Vercel.

---

## Prerequisites

- Vercel account (https://vercel.com)
- GitHub repository connected to Vercel
- Hosted MySQL database provisioned and migrations applied (see `docs/database-setup.md`)
- MyFatoorah merchant account with API keys
- OpenRouteService API key

---

## Step 1: Connect Repository

1. Go to https://vercel.com/new
2. Import the `FizzaWeb` GitHub repository.
3. Framework preset: **Next.js** (auto-detected).
4. Root directory: leave as `/` (default).
5. Build command: `npm run build` (default).
6. Output directory: `.next` (default).

---

## Step 2: Configure Environment Variables

In Vercel project settings → **Environment Variables**, add all variables from the table below.

| Variable | Environments | Notes |
|---|---|---|
| `DATABASE_URL` | Production, Preview | Use pooled connection string |
| `SESSION_SECRET` | Production, Preview | Different secret per environment |
| `APP_URL` | Production, Preview | Must match deployed domain exactly |
| `DISTANCE_PROVIDER` | Production, Preview | `OPENROUTESERVICE` |
| `OPENROUTESERVICE_API_KEY` | Production, Preview | Server-side only |
| `MYFATOORAH_API_KEY` | Production | Production key |
| `MYFATOORAH_API_KEY` | Preview | Test key |
| `MYFATOORAH_BASE_URL` | Production | `https://api.myfatoorah.com` |
| `MYFATOORAH_BASE_URL` | Preview | `https://apitest.myfatoorah.com` |
| `MYFATOORAH_WEBHOOK_SECRET` | Production, Preview | |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Production, Preview, Development | Mark "Expose to browser" ✅ |
| `STORAGE_DRIVER` | Production, Preview | `local` |
| `UPLOAD_MAX_SIZE_MB` | Production, Preview | `10` |

> ⚠️ Only `NEXT_PUBLIC_MAPBOX_TOKEN` should have "Expose to browser" checked. All other variables are server-side only.

---

## Step 3: Set APP_URL

`APP_URL` must match the deployed domain **exactly** (no trailing slash):

- Production: `https://fizza.sa` (or your custom domain)
- Preview: `https://your-project-git-branch.vercel.app`

This is used for MyFatoorah payment callback URLs. If it doesn't match, payment callbacks will fail.

---

## Step 4: Configure Custom Domain (Production)

1. In Vercel project settings → **Domains**.
2. Add your custom domain (e.g. `fizza.sa` and `www.fizza.sa`).
3. Update DNS records as instructed by Vercel.
4. Wait for DNS propagation and TLS certificate issuance (usually < 5 minutes).
5. Update `APP_URL` to the custom domain.

---

## Step 5: Configure MyFatoorah Webhook

1. Log in to the MyFatoorah merchant portal.
2. Navigate to **Webhook Settings**.
3. Set webhook URL: `https://YOUR_DOMAIN/api/payments/webhook`
4. Copy the webhook secret and set it as `MYFATOORAH_WEBHOOK_SECRET` in Vercel.
5. Enable the `Payment Success` and `Payment Failed` events.

---

## Step 6: Run Database Migrations

After deployment, run migrations against the production database:

```bash
# From your local machine with production DATABASE_URL set
npx prisma migrate deploy

# Seed initial data (first time only)
npx prisma db seed
```

Or set up a Vercel deployment hook that runs `prisma migrate deploy` as a post-deploy command.

---

## Step 7: Redeploy

After adding all environment variables:
1. Go to Vercel project → **Deployments**.
2. Click **Redeploy** on the latest deployment.
3. Wait for build to succeed.

---

## Step 8: Verify Deployment

Run through the production verification checklist: `docs/production-verification-checklist.md`

Key quick checks:
```bash
# Packages endpoint (should return 200 with Cache-Control header)
curl -I https://YOUR_DOMAIN/api/subscription-packages

# Health check (replace with your health endpoint if added)
curl https://YOUR_DOMAIN/api/add-ons
```

---

## Preview Deployments

Vercel automatically creates a preview deployment for every Pull Request. Each preview:
- Gets its own URL (e.g. `fizza-web-git-pr-42.vercel.app`)
- Uses the **Preview** environment variables (MyFatoorah test key)
- Is useful for testing PRs before merging to main

Set `APP_URL` for preview deployments to the Vercel-generated preview URL, or use a wildcard if your provider supports it.

---

## Rollback

If a deployment causes issues:
1. Vercel project → **Deployments**.
2. Find the last known-good deployment.
3. Click the three-dot menu → **Promote to Production**.

This instantly switches traffic back to the previous build.

---

## Status

| Step | Status |
|---|---|
| Repository connected to Vercel | ⚠️ BLOCKED — requires Vercel account and project setup |
| Environment variables configured | ⚠️ BLOCKED — requires real credentials |
| Custom domain configured | ⚠️ BLOCKED — requires domain ownership |
| MyFatoorah webhook configured | ⚠️ BLOCKED — requires merchant portal access |
| Migrations run on production DB | ⚠️ BLOCKED — requires production DB |
| Post-deploy verification complete | ⚠️ BLOCKED — requires all above |
