/**
 * GET /api/admin/trips/[id]
 * Full trip detail for admin operations.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { getDisplayLabel } from '@/lib/trips/statusCatalog';
import type { TripStatus } from '@/lib/trips/tripLifecycle';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        rider: { select: { id: true, name: true, relationship: true, school: true, parentId: true, parent: { select: { id: true, fullName: true, phone: true } } } },
        driver: { include: { profile: { select: { id: true, fullName: true, phone: true, avatarUrl: true } }, vehicle: true } },
        vehicle: true,
        subscription: {
          include: {
            package: { select: { name: true } },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
        chatMessages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true, body: true, senderRole: true, moderationStatus: true,
            messageType: true, attachmentUrl: true, createdAt: true,
          },
        },
        safetyReports: {
          select: { id: true, category: true, status: true, description: true, createdAt: true },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
    }

    const parentUserId = trip.subscription?.userId ?? trip.rider?.parentId ?? null;
    const [latestLocation, notifications] = await Promise.all([
      prisma.driverLocation.findFirst({
        where: { tripId: id },
        orderBy: { recordedAt: 'desc' },
        select: { lat: true, lng: true, recordedAt: true },
      }),
      parentUserId
        ? prisma.notification.findMany({
            where: { userId: parentUserId, type: 'TRIP' },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, title: true, message: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const gpsStale = latestLocation
      ? Date.now() - new Date(latestLocation.recordedAt).getTime() > 60_000
      : null;

    const flaggedCount = trip.chatMessages.filter(
      (m) => m.moderationStatus === 'FLAGGED' || m.moderationStatus === 'BLOCKED',
    ).length;

    return NextResponse.json({
      data: {
        trip: {
          ...trip,
          displayStatus: getDisplayLabel(trip.status as TripStatus),
        },
        parent: trip.rider?.parent ?? (trip.subscription?.userId
          ? await prisma.profile.findUnique({
              where: { id: trip.subscription.userId },
              select: { id: true, fullName: true, phone: true },
            })
          : null),
        location: latestLocation
          ? { ...latestLocation, stale: gpsStale ?? false }
          : null,
        notifications,
        chatSummary: {
          total: trip.chatMessages.length,
          flagged: flaggedCount,
          recent: trip.chatMessages,
        },
      },
      error: null,
    });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
