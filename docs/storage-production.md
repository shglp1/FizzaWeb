# Production file storage

FizzaWeb uploads (profile avatars, rider photos, safety evidence, driver documents, vehicle photos, chat images, subscription location photos) use a storage abstraction in `src/lib/storage/storageService.ts`.

## Drivers

| Driver | `STORAGE_DRIVER` | Use case |
|--------|------------------|----------|
| Local | `local` | Development — writes to `public/uploads/` |
| Cloudflare R2 | `r2` | Production on Vercel |

## Local (development)

```env
STORAGE_DRIVER=local
UPLOAD_MAX_SIZE_MB=5
```

Files are stored under `public/uploads/` with category folders:

- `avatars/{userId}/`
- `riders/{userId}/`
- `safety/{userId}/`
- `driver-documents/{userId}/`
- `subscription-locations/{userId}/pickup|dropoff/`
- `chat/{tripId}/`

**Not suitable for Vercel production** — ephemeral filesystem, not shared across instances.

## Cloudflare R2 (production)

### 1. Create R2 bucket

1. Cloudflare dashboard → R2 → Create bucket (e.g. `fizza-uploads`).
2. Enable public access via R2 custom domain or Cloudflare Workers/static site, or use a public bucket policy with a custom domain.

### 2. Create API token / access keys

1. R2 → Manage R2 API Tokens → Create API token with Object Read & Write on the bucket.
2. Note: Account ID, Access Key ID, Secret Access Key.

### 3. Configure public base URL

Use a custom domain or R2.dev public URL, e.g. `https://uploads.yourdomain.com` (no trailing slash).

### 4. Add env vars in Vercel

```env
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=fizza-uploads
R2_PUBLIC_BASE_URL=https://uploads.yourdomain.com
UPLOAD_MAX_SIZE_MB=5
```

### 5. Test upload

1. Deploy with R2 env configured.
2. Upload a profile avatar or driver document in staging.
3. Confirm the returned URL loads in the browser.
4. If R2 env is missing while `STORAGE_DRIVER=r2`, API returns **503** with: `Production file storage is not configured.`

### 6. Rollback to local (dev only)

Set `STORAGE_DRIVER=local` and remove R2 vars locally. Never use local storage in production.

## Security

- Server-side MIME validation per category
- Extension allow-list (no executables)
- Max size (`UPLOAD_MAX_SIZE_MB`)
- UUID filenames — no client-controlled paths
- R2 secrets are server-only — never exposed to the browser

## Migration from existing local files

Optional one-time script: copy `public/uploads/**` to R2 and update stored URLs in the database if you have dev data to preserve.
