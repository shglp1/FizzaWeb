import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

type RouteParams = {
  params: Promise<{ id: string }>;
};

const updateSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().min(7).max(20).optional(),
  role: z.enum(['PARENT', 'DRIVER', 'ADMIN']).optional(),
});

export async function GET(
  _req: Request,
  context: RouteParams,
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;

    const profile = await prisma.profile.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, createdAt: true } },
        riders: { select: { id: true, name: true, school: true, isActive: true, grade: true } },
        wallet: { select: { balanceSar: true } },
        loyaltyAccount: { select: { pointsBalance: true } },
        userSubscriptions: {
          select: {
            id: true,
            subscriptionType: true,
            status: true,
            paymentStatus: true,
            finalPriceSar: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        payments: {
          select: { id: true, amountSar: true, status: true, purpose: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        safetyReports: {
          select: { id: true, category: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        notifications: {
          where: { isRead: false },
          select: { id: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { data: null, error: { message: 'User not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
        ...profile,
        unreadNotifications: profile.notifications.length,
        notifications: undefined,
      },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: Request,
  context: RouteParams,
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { fullName, phone, role } = parsed.data;

    const existing = await prisma.profile.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'User not found' } },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;

    const updated = await prisma.$transaction(async (tx) => {
      const profile = await tx.profile.update({ where: { id }, data: updateData, select: { id: true, fullName: true, role: true, phone: true } });

      if (role && role !== existing.role) {
        await tx.user.update({ where: { id }, data: { role } });
      }

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'ADMIN_USER_UPDATED',
          details: JSON.stringify({ targetUserId: id, changes: updateData }),
        },
      });

      return profile;
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
