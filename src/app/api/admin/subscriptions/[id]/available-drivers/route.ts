import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

/**
 * GET /api/admin/subscriptions/:id/available-drivers
 *
 * Returns all non-suspended drivers. Marks which driver is currently assigned
 * to this subscription and includes a basic conflict flag (driver has other
 * active subscriptions on the same weekday schedule).
 *
 * Admin-only.
 */
export async function GET(
  _req: Request,
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

    // Fetch subscription to get its schedule (for conflict detection)
    const subscription = await prisma.userSubscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        assignedDriverId: true,
        startsOn: true,
        endsOn: true,
        schedules: { select: { weekday: true, isOffDay: true } },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { data: null, error: { message: 'Subscription not found' } },
        { status: 404 },
      );
    }

    const activeWeekdays = subscription.schedules
      .filter((s) => !s.isOffDay)
      .map((s) => s.weekday);

    // Fetch all non-suspended drivers with their profile and current assignments
    const drivers = await prisma.driver.findMany({
      where: { isSuspended: false },
      select: {
        id: true,
        availability: true,
        rating: true,
        profile: { select: { fullName: true, phone: true } },
        vehicle: { select: { model: true, plateNumber: true, color: true } },
        // Active subscription assignments that overlap our schedule
        driverAssignments: {
          where: {
            effectiveTo: null,
            subscriptionId: { not: subscriptionId }, // exclude self
            subscription: {
              status: { in: ['ACTIVE', 'PENDING'] },
            },
          },
          select: {
            subscriptionId: true,
            subscription: {
              select: {
                schedules: { select: { weekday: true, isOffDay: true } },
              },
            },
          },
        },
      },
      orderBy: [{ availability: 'desc' }, { rating: 'desc' }],
    });

    // Build response with conflict info
    const driverList = drivers.map((d) => {
      // Check if any existing assignment shares a weekday with this subscription
      const hasConflict = activeWeekdays.length > 0 && d.driverAssignments.some((assignment) => {
        const otherWeekdays = assignment.subscription.schedules
          .filter((s) => !s.isOffDay)
          .map((s) => s.weekday);
        return otherWeekdays.some((day) => activeWeekdays.includes(day));
      });

      return {
        id: d.id,
        fullName: d.profile?.fullName ?? 'Unknown',
        phone: d.profile?.phone ?? null,
        availability: d.availability,
        rating: d.rating ? Number(d.rating) : null,
        vehicle: d.vehicle
          ? {
              model: d.vehicle.model,
              plateNumber: d.vehicle.plateNumber,
              color: d.vehicle.color ?? null,
            }
          : null,
        isCurrentlyAssigned: d.id === subscription.assignedDriverId,
        hasScheduleConflict: hasConflict,
        activeSubscriptionCount: d.driverAssignments.length,
      };
    });

    return NextResponse.json({ data: driverList, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
