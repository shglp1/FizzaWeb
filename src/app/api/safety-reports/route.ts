import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { safetyReportCreateSchema, safetyListQuerySchema } from '@/lib/validations/safety';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { userId, role } = auth;

    const raw = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = safetyListQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Invalid query' } },
        { status: 400 },
      );
    }

    const { page, limit, status, category } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (role === 'ADMIN') {
      // Admin uses /api/admin/safety-reports; this endpoint shows own reports
    }

    // Drivers see reports on trips they are assigned to
    if (role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: userId },
        select: { id: true },
      });
      const tripIds = driver
        ? (
            await prisma.trip.findMany({
              where: { driverId: driver.id },
              select: { id: true },
            })
          ).map((t) => t.id)
        : [];
      where.OR = [{ userId }, ...(tripIds.length ? [{ tripId: { in: tripIds } }] : [])];
    } else {
      where.userId = userId;
    }

    if (status) where.status = status;
    if (category) where.category = category;

    const [reports, total] = await Promise.all([
      prisma.safetyReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          category: true,
          description: true,
          status: true,
          adminResponse: true,
          createdAt: true,
          updatedAt: true,
          trip: { select: { id: true, scheduledDate: true, pickupLocation: true, dropoffLocation: true } },
          attachments: { select: { id: true, filePath: true } },
        },
      }),
      prisma.safetyReport.count({ where }),
    ]);

    return NextResponse.json({
      data: { reports, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      error: null,
    });
  } catch (error) {
    console.error('[GET /api/safety-reports]', error);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, 'safety-reports:create', RATE_LIMITS.safetyReport);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { userId } = auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: { message: 'Invalid JSON body' } }, { status: 400 });
    }

    const parsed = safetyReportCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Validation error' } },
        { status: 400 },
      );
    }

    const { category, description, tripId, attachmentUrls } = parsed.data;

    // Verify trip ownership if tripId provided
    if (tripId) {
      const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        include: { subscription: { select: { userId: true } }, driver: { select: { profileId: true } } },
      });
      if (!trip) {
        return NextResponse.json({ data: null, error: { message: 'Trip not found' } }, { status: 404 });
      }
      const isOwner = trip.subscription?.userId === userId;
      const isDriver = trip.driver?.profileId === userId;
      if (!isOwner && !isDriver) {
        return NextResponse.json({ data: null, error: { message: 'Not authorised to report this trip' } }, { status: 403 });
      }
    }

    const reportId = randomUUID();

    await prisma.$transaction(async (tx) => {
      await tx.safetyReport.create({
        data: {
          id: reportId,
          userId,
          tripId: tripId ?? null,
          category,
          description,
        },
      });

      if (attachmentUrls?.length) {
        await tx.safetyReportAttachment.createMany({
          data: attachmentUrls.map((url) => ({
            id: randomUUID(),
            reportId,
            filePath: url,
          })),
        });
      }

      // Notify admins (use a well-known type; userId null = broadcast)
      await tx.notification.create({
        data: {
          id: randomUUID(),
          userId: null,
          title: 'New Safety Report',
          message: `A new ${category} safety report has been submitted.`,
          type: 'SAFETY',
        },
      });

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          userId,
          action: 'SAFETY_REPORT_CREATED',
          details: JSON.stringify({ reportId, category, tripId }),
        },
      });
    });

    return NextResponse.json({ data: { reportId }, error: null }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/safety-reports]', error);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}
