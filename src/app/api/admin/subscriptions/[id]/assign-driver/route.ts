import 'server-only';
import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

const assignDriverSchema = z.object({
  driverId: z.string().uuid('Invalid driver ID'),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveFrom must be YYYY-MM-DD')
    .optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/admin/subscriptions/:id/assign-driver
 *
 * Assign (or reassign) a driver to a subscription.
 *
 * Business rules:
 * - Admin-only.
 * - Closes the current open assignment (sets effectiveTo to today) before creating the new one.
 * - Updates UserSubscription.assignedDriverId for fast trip-generation lookups.
 * - Creates an audit log entry.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    if (auth.role !== 'ADMIN') {
      return NextResponse.json(
        { data: null, error: { message: 'Forbidden' } },
        { status: 403 },
      );
    }

    const { id: subscriptionId } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid JSON body' } },
        { status: 400 },
      );
    }

    const parsed = assignDriverSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Validation error' } },
        { status: 400 },
      );
    }

    const { driverId, effectiveFrom, notes } = parsed.data;

    // Verify subscription exists
    const subscription = await prisma.userSubscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, status: true, assignedDriverId: true },
    });
    if (!subscription) {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription not found' } },
        { status: 404 },
      );
    }

    // Verify driver exists and is not suspended
    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, isSuspended: true, profile: { select: { fullName: true } } },
    });
    if (!driver) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver not found' } },
        { status: 404 },
      );
    }
    if (driver.isSuspended) {
      return NextResponse.json(
        { data: null, error: { message: 'Cannot assign a suspended driver' } },
        { status: 422 },
      );
    }

    const today = toIsoDate(new Date());
    const effectiveFromDate = effectiveFrom ?? today;

    const assignment = await prisma.$transaction(async (tx) => {
      // Close any open assignment for this subscription
      await tx.subscriptionDriverAssignment.updateMany({
        where: { subscriptionId, effectiveTo: null },
        data: { effectiveTo: new Date(today) },
      });

      // Create the new assignment
      const newAssignment = await tx.subscriptionDriverAssignment.create({
        data: {
          id: randomUUID(),
          subscriptionId,
          driverId,
          effectiveFrom: new Date(effectiveFromDate),
          effectiveTo: null, // open-ended = current assignment
          assignedBy: auth.userId,
          notes: notes ?? null,
        },
        select: {
          id: true,
          subscriptionId: true,
          driverId: true,
          effectiveFrom: true,
          effectiveTo: true,
          notes: true,
          createdAt: true,
          driver: { select: { id: true, profile: { select: { fullName: true } } } },
        },
      });

      // Update denormalised assignedDriverId on the subscription
      await tx.userSubscription.update({
        where: { id: subscriptionId },
        data: { assignedDriverId: driverId },
      });

      // Update future SCHEDULED trips that belong to this subscription and have no driver
      await tx.trip.updateMany({
        where: {
          subscriptionId,
          status: 'SCHEDULED',
          driverId: null,
          scheduledDate: { gte: new Date(effectiveFromDate) },
        },
        data: { driverId },
      });

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          userId: auth.userId,
          action: 'SUBSCRIPTION_DRIVER_ASSIGNED',
          details: JSON.stringify({
            subscriptionId,
            driverId,
            effectiveFrom: effectiveFromDate,
            previousDriverId: subscription.assignedDriverId ?? null,
            assignmentId: newAssignment.id,
          }),
        },
      });

      return newAssignment;
    });

    return NextResponse.json({ data: assignment, error: null }, { status: 201 });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
