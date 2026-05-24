import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

type RouteParams = { params: Promise<{ id: string }> };

const profileSchema = z.object({
  ratePerKmSar: z.number().min(0).nullable().optional(),
  platformFeePercent: z.number().min(0).max(100).nullable().optional(),
});

export async function GET(_req: Request, context: RouteParams) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id: driverId } = await context.params;

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });
    if (!driver) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver not found' } },
        { status: 404 },
      );
    }

    const profile = await prisma.driverPayProfile.findUnique({ where: { driverId } });
    return NextResponse.json({ data: profile, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request, context: RouteParams) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id: driverId } = await context.params;
    const body = await req.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true },
    });
    if (!driver) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver not found' } },
        { status: 404 },
      );
    }

    const { ratePerKmSar, platformFeePercent } = parsed.data;

    const profile = await prisma.$transaction(async (tx) => {
      const result = await tx.driverPayProfile.upsert({
        where: { driverId },
        update: {
          ...(ratePerKmSar !== undefined ? { ratePerKmSar } : {}),
          ...(platformFeePercent !== undefined ? { platformFeePercent } : {}),
        },
        create: {
          driverId,
          ratePerKmSar: ratePerKmSar ?? null,
          platformFeePercent: platformFeePercent ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'DRIVER_PAY_PROFILE_UPDATED',
          details: JSON.stringify({ driverId, ratePerKmSar, platformFeePercent }),
        },
      });

      return result;
    });

    return NextResponse.json({ data: profile, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
