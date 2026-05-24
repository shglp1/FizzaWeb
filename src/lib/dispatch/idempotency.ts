/**
 * Trip generation idempotency — duplicate detection key.
 * Query-level guard used before create; matches DB unique constraint when present.
 */
export type TripGenerationKey = {
  subscriptionId: string;
  riderId: string;
  scheduledDate: Date | string;
  legType: 'OUTBOUND' | 'RETURN';
};

export function buildTripDuplicateWhere(key: TripGenerationKey) {
  const date = key.scheduledDate instanceof Date ? key.scheduledDate : new Date(key.scheduledDate);
  return {
    subscriptionId: key.subscriptionId,
    riderId: key.riderId,
    scheduledDate: date,
    legType: key.legType,
  } as const;
}

/** Returns true when an existing row would cause generation to skip (idempotent). */
export function isDuplicateTripGeneration(
  existing: { id: string } | null | undefined,
): boolean {
  return existing != null;
}

/** Payment/webhook replay must not re-trigger generation after first activation. */
export function shouldTriggerTripGenerationAfterPayment(
  subscriptionActivated: boolean,
  subscriptionId: string | null | undefined,
): boolean {
  return subscriptionActivated && subscriptionId != null && subscriptionId.length > 0;
}

/** Generation report notifications only when new work occurred. */
export function shouldNotifyGenerationReport(input: {
  generatedCount: number;
  needsDispatchCount: number;
}): boolean {
  return input.generatedCount > 0 || input.needsDispatchCount > 0;
}
