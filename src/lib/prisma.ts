import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  slowQueryMiddlewareAttached: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Slow-query logging (dev/staging only). Enable with LOG_SLOW_QUERIES=true.
// Surfaces N+1 patterns and unindexed scans without needing EXPLAIN in production.
// Guarded by a global flag so hot-reload / repeated imports don't stack middleware.
const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? 100);
if (
  process.env.LOG_SLOW_QUERIES === 'true' &&
  !globalForPrisma.slowQueryMiddlewareAttached
) {
  globalForPrisma.slowQueryMiddlewareAttached = true;
  prisma.$use(async (params, next) => {
    const start = Date.now();
    const result = await next(params);
    const durationMs = Date.now() - start;
    if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SLOW QUERY] ${params.model ?? 'raw'}.${params.action} — ${durationMs}ms`,
      );
    }
    return result;
  });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
