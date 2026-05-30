/**
 * Trip wallet credit amount computation and processing for CREDIT_PARENT decisions.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.ts';

type DbClient = Prisma.TransactionClient | typeof prisma;

export class TripWalletCreditError extends Error {
  code:
    | 'TRIP_NOT_FOUND'
    | 'NOT_COMPLETED'
    | 'ALREADY_CREDITED'
    | 'NO_PARENT'
    | 'NO_SUBSCRIPTION'
    | 'INVALID_AMOUNT'
    | 'ALREADY_RESOLVED'
    | 'AMOUNT_MISMATCH';

  constructor(message: string, code: TripWalletCreditError['code']) {
    super(message);
    this.name = 'TripWalletCreditError';
    this.code = code;
  }
}

export function tripWalletCreditIdempotencyKey(tripId: string): string {
  return `trip-financial-credit:${tripId}`;
}

/** Detect Prisma unique constraint violation (e.g. concurrent idempotency race). */
export function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object'
    && err !== null
    && 'code' in err
    && (err as { code: string }).code === 'P2002'
  );
}

async function buildDuplicateCreditResult(
  db: DbClient,
  input: {
    tripId: string;
    adminUserId: string;
    reason: string;
    preview: TripCreditPreview;
    idempotencyKey: string;
  },
): Promise<ProcessTripWalletCreditResult> {
  const existingByKey = await db.walletTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });

  const trip = await db.trip.findUnique({
    where: { id: input.tripId },
    select: {
      id: true,
      walletCreditTransactionId: true,
      financialReviewStatus: true,
      financialReviewReason: true,
      subscription: { select: { userId: true } },
      rider: { select: { parentId: true } },
    },
  });

  const txId = existingByKey?.id ?? trip?.walletCreditTransactionId;
  if (!txId) {
    throw new TripWalletCreditError(
      'Wallet credit already exists but could not be resolved — retry or contact engineering',
      'ALREADY_CREDITED',
    );
  }

  const parentId = trip?.subscription?.userId ?? trip?.rider?.parentId ?? input.preview.parentId;
  const wallet = parentId
    ? await db.wallet.findUnique({ where: { userId: parentId } })
    : null;

  const existingTx = existingByKey ?? await db.walletTransaction.findUnique({ where: { id: txId } });

  const needsTripUpdate =
    !trip
    || trip.financialReviewStatus !== 'CREDIT_PARENT'
    || !trip.walletCreditTransactionId;

  const tripRecord = needsTripUpdate
    ? await db.trip.update({
        where: { id: input.tripId },
        data: {
          financialReviewStatus: 'CREDIT_PARENT',
          financialReviewReason: input.reason.trim(),
          financialReviewedAt: new Date(),
          financialReviewedBy: input.adminUserId,
          walletCreditTransactionId: txId,
        },
        select: {
          id: true,
          financialReviewStatus: true,
          financialReviewReason: true,
          walletCreditTransactionId: true,
        },
      })
    : {
        id: trip!.id,
        financialReviewStatus: 'CREDIT_PARENT' as const,
        financialReviewReason: trip!.financialReviewReason ?? input.reason.trim(),
        walletCreditTransactionId: txId,
      };

  return {
    duplicate: true,
    trip: tripRecord,
    walletTransaction: {
      id: txId,
      amountSar: Number(existingTx?.amountSar ?? input.preview.amountSar),
      newBalanceSar: Number(wallet?.balanceSar ?? 0),
    },
  };
}

export type TripCreditPreview = {
  tripId: string;
  parentId: string;
  parentName: string;
  amountSar: number;
  amountExplanation: string;
  subscriptionId: string | null;
  finalPriceSar: number | null;
  expectedTripLegs: number;
  alreadyCredited: boolean;
  existingTransactionId: string | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Pro-rate subscription final price across expected trip legs in the billing period. */
export function computeTripWalletCreditAmount(input: {
  finalPriceSar: number;
  actualServiceDays: number | null;
  tripDirection: 'ONE_WAY' | 'ROUND_TRIP';
  subscriptionTripCount: number;
}): { amountSar: number; explanation: string; expectedLegs: number } {
  const legsPerDay = input.tripDirection === 'ROUND_TRIP' ? 2 : 1;
  const serviceDays = Math.max(1, input.actualServiceDays ?? 1);
  let expectedLegs = serviceDays * legsPerDay;

  if (input.subscriptionTripCount > 0) {
    expectedLegs = Math.max(expectedLegs, input.subscriptionTripCount);
  }

  expectedLegs = Math.max(1, expectedLegs);
  const amountSar = round2(input.finalPriceSar / expectedLegs);

  if (amountSar <= 0) {
    throw new TripWalletCreditError('Computed credit amount must be positive', 'INVALID_AMOUNT');
  }

  return {
    amountSar,
    expectedLegs,
    explanation: `SAR ${input.finalPriceSar.toFixed(2)} subscription ÷ ${expectedLegs} expected trip leg(s) = SAR ${amountSar.toFixed(2)} per leg`,
  };
}

export async function previewTripWalletCredit(tripId: string): Promise<TripCreditPreview> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      status: true,
      walletCreditTransactionId: true,
      financialReviewStatus: true,
      subscriptionId: true,
      subscription: {
        select: {
          id: true,
          userId: true,
          finalPriceSar: true,
          actualServiceDays: true,
          tripDirection: true,
          user: { select: { id: true, fullName: true } },
          _count: { select: { trips: true } },
        },
      },
      rider: { select: { parentId: true, parent: { select: { id: true, fullName: true } } } },
    },
  });

  if (!trip) throw new TripWalletCreditError('Trip not found', 'TRIP_NOT_FOUND');
  if (trip.status !== 'COMPLETED') {
    throw new TripWalletCreditError('Trip must be completed before wallet credit', 'NOT_COMPLETED');
  }

  const parentId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
  const parentName = trip.subscription?.user.fullName ?? trip.rider?.parent.fullName ?? 'Parent';
  if (!parentId) throw new TripWalletCreditError('Cannot determine parent for this trip', 'NO_PARENT');
  if (!trip.subscription) {
    throw new TripWalletCreditError('Trip has no subscription — cannot compute credit amount safely', 'NO_SUBSCRIPTION');
  }

  const { amountSar, explanation, expectedLegs } = computeTripWalletCreditAmount({
    finalPriceSar: Number(trip.subscription.finalPriceSar),
    actualServiceDays: trip.subscription.actualServiceDays,
    tripDirection: trip.subscription.tripDirection,
    subscriptionTripCount: trip.subscription._count.trips,
  });

  const existingTx = trip.walletCreditTransactionId
    ? await prisma.walletTransaction.findUnique({ where: { id: trip.walletCreditTransactionId } })
    : await prisma.walletTransaction.findUnique({
        where: { idempotencyKey: tripWalletCreditIdempotencyKey(tripId) },
      });

  return {
    tripId,
    parentId,
    parentName,
    amountSar,
    amountExplanation: explanation,
    subscriptionId: trip.subscriptionId,
    finalPriceSar: Number(trip.subscription.finalPriceSar),
    expectedTripLegs: expectedLegs,
    alreadyCredited: Boolean(existingTx || trip.walletCreditTransactionId),
    existingTransactionId: existingTx?.id ?? trip.walletCreditTransactionId,
  };
}

export type ProcessTripWalletCreditResult = {
  trip: {
    id: string;
    financialReviewStatus: string | null;
    financialReviewReason: string | null;
    walletCreditTransactionId: string | null;
  };
  walletTransaction: {
    id: string;
    amountSar: number;
    newBalanceSar: number;
  };
  duplicate: boolean;
};

export async function processTripWalletCredit(input: {
  tripId: string;
  adminUserId: string;
  reason: string;
  confirmAmountSar: number;
}): Promise<ProcessTripWalletCreditResult> {
  if (input.reason.trim().length < 3) {
    throw new TripWalletCreditError('Reason is required (min 3 characters)', 'INVALID_AMOUNT');
  }

  const preview = await previewTripWalletCredit(input.tripId);

  if (Math.abs(preview.amountSar - input.confirmAmountSar) > 0.01) {
    throw new TripWalletCreditError(
      `Confirmed amount SAR ${input.confirmAmountSar.toFixed(2)} does not match computed SAR ${preview.amountSar.toFixed(2)}`,
      'AMOUNT_MISMATCH',
    );
  }

  const idempotencyKey = tripWalletCreditIdempotencyKey(input.tripId);

  try {
    return await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: input.tripId },
        select: {
          id: true,
          status: true,
          walletCreditTransactionId: true,
          financialReviewStatus: true,
          subscriptionId: true,
          subscription: { select: { userId: true } },
          rider: { select: { parentId: true } },
        },
      });

      if (!trip) throw new TripWalletCreditError('Trip not found', 'TRIP_NOT_FOUND');
      if (trip.status !== 'COMPLETED') {
        throw new TripWalletCreditError('Trip must be completed', 'NOT_COMPLETED');
      }

      const parentId = trip.subscription?.userId ?? trip.rider?.parentId;
      if (!parentId || parentId !== preview.parentId) {
        throw new TripWalletCreditError('Parent validation failed', 'NO_PARENT');
      }

      if (
        trip.financialReviewStatus
        && trip.financialReviewStatus !== 'PENDING'
        && trip.financialReviewStatus !== 'CREDIT_PARENT'
      ) {
        throw new TripWalletCreditError(
          'Trip financial review already resolved with a different decision',
          'ALREADY_RESOLVED',
        );
      }

      const existingByKey = await tx.walletTransaction.findUnique({ where: { idempotencyKey } });
      if (existingByKey || trip.walletCreditTransactionId) {
        return buildDuplicateCreditResult(tx, {
          tripId: input.tripId,
          adminUserId: input.adminUserId,
          reason: input.reason,
          preview,
          idempotencyKey,
        });
      }

      const wallet = await tx.wallet.upsert({
        where: { userId: parentId },
        create: { userId: parentId, balanceSar: 0 },
        update: {},
        select: { id: true, balanceSar: true },
      });

      const newBalance = round2(Number(wallet.balanceSar) + preview.amountSar);

      const walletTx = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          tripId: input.tripId,
          amountSar: preview.amountSar,
          txType: 'CREDIT',
          source: 'TRIP_FINANCIAL_CREDIT',
          idempotencyKey,
          adminUserId: input.adminUserId,
          reason: input.reason.trim(),
          description: `Trip financial review credit: ${input.reason.trim()}`,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceSar: newBalance },
      });

      const updatedTrip = await tx.trip.update({
        where: { id: input.tripId },
        data: {
          financialReviewStatus: 'CREDIT_PARENT',
          financialReviewReason: input.reason.trim(),
          financialReviewedAt: new Date(),
          financialReviewedBy: input.adminUserId,
          walletCreditTransactionId: walletTx.id,
        },
        select: {
          id: true,
          financialReviewStatus: true,
          financialReviewReason: true,
          walletCreditTransactionId: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: input.adminUserId,
          action: 'TRIP_FINANCIAL_REVIEW',
          details: JSON.stringify({
            tripId: input.tripId,
            action: 'CREDIT_PARENT',
            reason: input.reason.trim(),
            amountSar: preview.amountSar,
            walletId: wallet.id,
            walletTransactionId: walletTx.id,
            parentId,
            automatedWalletCredit: true,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: input.adminUserId,
          action: 'TRIP_WALLET_CREDIT',
          details: JSON.stringify({
            tripId: input.tripId,
            walletTransactionId: walletTx.id,
            amountSar: preview.amountSar,
            parentId,
            idempotencyKey,
          }),
        },
      });

      await tx.notification.create({
        data: {
          userId: parentId,
          title: 'Wallet credited',
          message: `SAR ${preview.amountSar.toFixed(2)} was added to your wallet following a trip review. Reference: ${walletTx.id.slice(0, 8)}…`,
          type: 'WALLET_TOP_UP',
        },
      });

      return {
        duplicate: false,
        trip: updatedTrip,
        walletTransaction: {
          id: walletTx.id,
          amountSar: preview.amountSar,
          newBalanceSar: newBalance,
        },
      };
    });
  } catch (err) {
    if (isPrismaUniqueViolation(err)) {
      // Run the duplicate-recovery path inside its own transaction so the
      // trip.walletCreditTransactionId update is atomic with the lookups.
      return prisma.$transaction(async (tx) =>
        buildDuplicateCreditResult(tx, {
          tripId: input.tripId,
          adminUserId: input.adminUserId,
          reason: input.reason,
          preview,
          idempotencyKey,
        }),
      );
    }
    throw err;
  }
}

export async function processNonCreditFinancialReview(input: {
  tripId: string;
  adminUserId: string;
  action: Exclude<string, 'CREDIT_PARENT'>;
  reason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.findUnique({
      where: { id: input.tripId },
      select: { id: true, status: true, financialReviewStatus: true, walletCreditTransactionId: true },
    });
    if (!trip) throw new TripWalletCreditError('Trip not found', 'TRIP_NOT_FOUND');
    if (trip.status !== 'COMPLETED') {
      throw new TripWalletCreditError('Financial review applies to completed trips only', 'NOT_COMPLETED');
    }
    if (trip.walletCreditTransactionId) {
      throw new TripWalletCreditError('Trip already has wallet credit — cannot change decision', 'ALREADY_CREDITED');
    }
    if (trip.financialReviewStatus && trip.financialReviewStatus !== 'PENDING') {
      throw new TripWalletCreditError('Financial review already resolved', 'ALREADY_RESOLVED');
    }

    const updated = await tx.trip.update({
      where: { id: input.tripId },
      data: {
        financialReviewStatus: input.action as Prisma.TripUpdateInput['financialReviewStatus'],
        financialReviewReason: input.reason.trim(),
        financialReviewedAt: new Date(),
        financialReviewedBy: input.adminUserId,
      },
      select: {
        id: true,
        financialReviewStatus: true,
        financialReviewReason: true,
        financialReviewedAt: true,
        walletCreditTransactionId: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: input.adminUserId,
        action: 'TRIP_FINANCIAL_REVIEW',
        details: JSON.stringify({
          tripId: input.tripId,
          action: input.action,
          reason: input.reason.trim(),
          previousStatus: trip.financialReviewStatus,
          automatedWalletCredit: false,
        }),
      },
    });

    return updated;
  });
}
