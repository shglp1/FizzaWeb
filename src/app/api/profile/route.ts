import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { profileUpdateSchema } from '@/lib/validations/profile';

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  user: { select: { email: true, role: true } },
} as const;

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const profile = await prisma.profile.findUnique({
      where: { id: auth.userId },
      select: PROFILE_SELECT,
    });

    if (!profile) {
      return NextResponse.json(
        { data: null, error: { message: 'Profile not found' } },
        { status: 404 },
      );
    }

    let extras: Record<string, unknown> = {};

    if (auth.role === 'PARENT') {
      const [ridersCount, activeSubscriptions, wallet] = await Promise.all([
        prisma.rider.count({ where: { parentId: auth.userId, isActive: true } }),
        prisma.userSubscription.count({ where: { userId: auth.userId, status: 'ACTIVE' } }),
        prisma.wallet.findUnique({ where: { userId: auth.userId }, select: { balanceSar: true } }),
      ]);
      extras = {
        ridersCount,
        activeSubscriptions,
        walletBalanceSar: wallet?.balanceSar != null ? Number(wallet.balanceSar) : 0,
      };
    }

    if (auth.role === 'DRIVER') {
      const driver = await prisma.driver.findFirst({
        where: { profileId: auth.userId },
        select: {
          rating: true,
          vehicle: { select: { model: true, color: true, plateNumber: true, capacity: true } },
        },
      });
      if (driver) {
        const v = driver.vehicle;
        extras = {
          driverRating: driver.rating != null ? Number(driver.rating).toFixed(1) : null,
          vehicleSummary: v
            ? [v.color, v.model, v.plateNumber].filter(Boolean).join(' · ')
            : null,
        };
      }
    }

    return NextResponse.json({ data: { profile: { ...profile, extras } }, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = profileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { fullName, phone, avatarUrl } = parsed.data;

    const profile = await prisma.profile.update({
      where: { id: auth.userId },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(phone !== undefined && { phone }),
        ...(avatarUrl !== undefined && { avatarUrl: avatarUrl || null }),
      },
      select: PROFILE_SELECT,
    });

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      null;

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'PROFILE_UPDATED',
        details: JSON.stringify({ updatedFields: Object.keys(parsed.data) }),
        ipAddress: ip,
      },
    });

    return NextResponse.json({ data: { profile }, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
