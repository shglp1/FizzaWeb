import 'server-only';

import type { LocationConfidence, MapLocationKind } from '@prisma/client';
import { needsAdminReview, type LocationConfidenceLevel, type LocationSourceTag } from './confidence.ts';

export type LocationMetaInput = {
  label: string;
  latitude: number;
  longitude: number;
  source?: string | null;
  confidence?: LocationConfidenceLevel | null;
  placeId?: string | null;
  isVerifiedPlace?: boolean;
  isManual?: boolean;
};

function toSourceTag(source?: string | null, isManual?: boolean): LocationSourceTag {
  if (isManual) return 'MANUAL';
  if (source === 'LOCAL') return 'LOCAL';
  if (source === 'ORS') return 'ORS';
  if (source === 'NOMINATIM') return 'NOMINATIM';
  return 'MANUAL';
}

function toDbConfidence(level: LocationConfidenceLevel): LocationConfidence {
  return level as LocationConfidence;
}

export async function createLocationReviewIfNeeded(
  input: LocationMetaInput & { subscriptionId: string; locationKind: MapLocationKind },
): Promise<void> {
  const source = toSourceTag(input.source, input.isManual);
  const confidence = (input.confidence ?? 'LOW') as LocationConfidenceLevel;
  if (!needsAdminReview(confidence, source, input.isVerifiedPlace)) return;

  const { prisma } = await import('@/lib/prisma');
  await prisma.mapLocationReview.create({
    data: {
      subscriptionId: input.subscriptionId,
      locationKind: input.locationKind,
      label: input.label,
      latitude: input.latitude,
      longitude: input.longitude,
      source,
      confidence: toDbConfidence(confidence),
      placeId: input.placeId ?? null,
      status: 'PENDING',
    },
  });
}

export async function listPendingLocationReviews(page = 1, limit = 20) {
  const take = Math.min(50, Math.max(1, limit));
  const skip = (Math.max(1, page) - 1) * take;
  const { prisma } = await import('@/lib/prisma');
  const [items, total] = await Promise.all([
    prisma.mapLocationReview.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { subscription: { select: { id: true, pickupLocation: true, dropoffLocation: true } } },
    }),
    prisma.mapLocationReview.count({ where: { status: 'PENDING' } }),
  ]);
  return { items, total, page, limit: take };
}
