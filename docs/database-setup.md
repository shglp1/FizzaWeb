# Database Setup

This document covers hosted MySQL provider options, how to apply migrations, seed the database, and verify readiness before deployment.

---

## Provider Recommendations

FizzaWeb requires a **hosted MySQL 8.x** database. `localhost` MySQL will not work on Vercel (serverless functions cannot reach it).

| Provider | Free Tier | Notes |
|---|---|---|
| **Railway** | 500 MB / $5 credit | Easiest setup; connection string ready in 30 seconds |
| **PlanetScale** | 5 GB / 1 billion row reads | Branching workflow; no foreign-key enforcement by default (see note) |
| **Aiven** | 1 node free trial | Production-grade; supports connection pooling |
| **DigitalOcean Managed MySQL** | From $15/mo | Best for production; automated backups, failover |
| **AWS RDS MySQL** | Free tier 12 months | Good for AWS-native stacks |

> ⚠️ **PlanetScale note**: PlanetScale disables foreign key constraints by default. FizzaWeb's schema relies on FK constraints for referential integrity. Use `@@ignore` workarounds or switch to a provider that supports FKs (Railway, Aiven, DigitalOcean, RDS).

---

## Local Development

For local development, MySQL 8.x is recommended via Docker:

```bash
docker run -d \
  --name fizzaweb-mysql \
  -e MYSQL_ROOT_PASSWORD=localpass \
  -e MYSQL_DATABASE=fizzaweb \
  -p 3306:3306 \
  mysql:8.0
```

Set in `.env`:
```env
DATABASE_URL=mysql://root:localpass@localhost:3306/fizzaweb
```

---

## Applying Migrations

### Option A — Prisma Migrate (recommended for development and staging)

```bash
# Generate Prisma client (always run after schema changes)
npx prisma generate

# Apply all pending migrations
npx prisma migrate dev

# Apply migrations in production/staging (no prompt, no shadow DB)
npx prisma migrate deploy
```

### Option B — Raw SQL migration (for production if Prisma migrate deploy is unavailable)

The full schema and all indexes are in:

```
prisma/migrations/init_mysql_schema.sql
```

Apply it directly:

```bash
mysql -h HOST -u USER -p DATABASE < prisma/migrations/init_mysql_schema.sql
```

Or via Railway/Aiven web console SQL editor.

---

## Seeding

After migrations, seed the database with initial data (admin user, sample packages, add-ons):

```bash
npx prisma db seed
```

The seed script is at `prisma/seed.ts`. It creates:
- An admin user (`admin@fizza.sa` / `Admin1234!`)
- Default subscription packages (e.g. 10-trip, 20-trip, 30-trip)
- Default add-ons (e.g. extra stops, waiting time)

> ⚠️ Change the admin password immediately after first login in production.

---

## Connection Pooling

Vercel serverless functions create a new database connection on each cold start. Without connection pooling, this exhausts MySQL's `max_connections` under load.

**Recommended**: Use **PgBouncer-style pooling** or the provider's built-in proxy.

| Provider | Pooling option |
|---|---|
| Railway | Enable PgBouncer-compatible proxy in settings |
| PlanetScale | Built-in connection pooling |
| Aiven | Connection pooler (PgBouncer) available |
| DigitalOcean | Managed connection pool in the control panel |

In `DATABASE_URL`, use the **pooled** connection string if your provider offers one:

```env
# Example Railway pooled endpoint
DATABASE_URL=mysql://root:pass@proxy.railway.app:6543/fizzaweb
```

---

## Migration Verification Checklist

After running migrations, verify the schema is correct:

```sql
-- Verify all tables exist
SHOW TABLES;

-- Verify Trip indexes (critical path — was missing before Task 9)
SHOW INDEX FROM trips;
-- Expected: idx on subscription_id, rider_id, driver_id, status, scheduled_date, leg_type, created_at

-- Verify AuditLog indexes
SHOW INDEX FROM audit_logs;

-- Verify DriverLocation indexes
SHOW INDEX FROM driver_locations;

-- Verify foreign keys
SELECT TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME;
```

All tables should be present with their indexes. If any are missing, re-run the migration or apply the SQL manually.

---

## Backup Strategy

- **Development/Staging**: No formal backup required.
- **Production**: Enable automated daily backups in your provider's control panel.
  - Railway: Enable automatic backups (paid plan).
  - DigitalOcean: 7-day automated backups included.
  - AWS RDS: Enable automated snapshots (1–35 day retention).

Manual backup before a risky migration:

```bash
mysqldump -h HOST -u USER -p DATABASE > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## Status

| Step | Status |
|---|---|
| Schema designed and reviewed | ✅ Done |
| Indexes added for all hot query paths | ✅ Done (Task 9 Part D) |
| `init_mysql_schema.sql` updated with indexes | ✅ Done |
| Local Docker setup verified | ✅ Done |
| Hosted provider connected | ⚠️ BLOCKED — requires real credentials |
| `prisma migrate deploy` on hosted DB | ⚠️ BLOCKED — requires real hosted DB |
| Seed run on staging | ⚠️ BLOCKED — requires real hosted DB |
| Connection pooling configured | ⚠️ BLOCKED — requires real hosted DB |
