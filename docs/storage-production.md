# Production file storage

FizzaWeb uploads (profile avatars, rider photos, safety evidence, driver documents, chat images, location photos) must **not** rely on `public/uploads/` in production.

## Local driver (development only)

| Setting | Value |
|---------|--------|
| `STORAGE_DRIVER` | `local` |
| Path | `public/uploads/{category}/…` |
| Served by | Next.js static files |

Works on a single machine. **Not suitable for Vercel/serverless** — the filesystem is ephemeral and not shared across instances.

## Recommended production: Cloudflare R2

R2 is S3-compatible, low cost, and works well with Vercel.

### Required environment variables (future implementation)

```env
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=fizza-uploads
R2_PUBLIC_BASE_URL=https://uploads.yourdomain.com
UPLOAD_MAX_SIZE_MB=5
```

### Migration plan

1. Implement `saveToR2()` in `src/lib/storage/r2Upload.ts` mirroring `localUpload.ts` APIs.
2. Branch on `STORAGE_DRIVER` in `saveUserUpload`, `saveChatImage`, `saveLocationPhoto`.
3. Return public URLs using `R2_PUBLIC_BASE_URL` + object key.
4. One-time script: copy existing `public/uploads/**` objects to R2 and update DB URLs if any absolute paths were stored.
5. Set `STORAGE_DRIVER=r2` in Vercel production env.
6. Remove reliance on committed `public/uploads/` (add to `.gitignore` if not already).

## Security checklist (current local implementation)

- MIME type allow-list per category (server-side)
- Max size enforced (`UPLOAD_MAX_SIZE_MB`)
- No executable extensions (`.exe`, `.sh`, etc.)
- UUID filenames — no user-controlled paths
- URLs are `/uploads/users/{userId}/{category}/{uuid}.ext` — no path traversal

## Production blocker status

| Item | Status |
|------|--------|
| Local uploads for dev | ✅ Implemented |
| R2/S3 driver | ❌ **Not implemented — P0 before production deploy** |
| CDN public URL | ❌ Required with R2 |

Until R2 (or equivalent) ships, treat file upload as **dev/staging only**.
