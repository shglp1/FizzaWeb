/**
 * Trip event recording with deduplication (Task 12.1).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function toMetadata(
  metadata?: Record<string, string | number | boolean | null>,
): Prisma.InputJsonValue | undefined {
  if (metadata === undefined) return undefined;
  return metadata as Prisma.InputJsonValue;
}

/**
 * Record a TripEvent once per tripId + eventType.
 * Returns true if created, false if deduplicated.
 */
export async function recordTripEventOnce(
  tripId: string,
  eventType: string,
  message: string,
  opts?: {
    actorUserId?: string | null;
    actorRole?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<boolean> {
  const existing = await prisma.tripEvent.findFirst({
    where: { tripId, eventType },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.tripEvent.create({
    data: {
      tripId,
      eventType,
      message,
      actorUserId: opts?.actorUserId ?? null,
      actorRole: opts?.actorRole ?? null,
      metadata: toMetadata(opts?.metadata),
    },
  });
  return true;
}
