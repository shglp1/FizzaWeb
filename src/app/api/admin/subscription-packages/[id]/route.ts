import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

const updatePackageSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  billingCycle: z.string().min(1).max(50).optional(),
  priceSar: z.number().positive().optional(),
  description: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: RouteParams,
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const adminId = auth.userId;
    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid JSON body' } },
        { status: 400 },
      );
    }

    const parsed = updatePackageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Validation error' } },
        { status: 400 },
      );
    }

    const existing = await prisma.subscriptionPackage.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'Package not found' } },
        { status: 404 },
      );
    }

    const updated = await prisma.subscriptionPackage.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.billingCycle !== undefined && { billingCycle: parsed.data.billingCycle }),
        ...(parsed.data.priceSar !== undefined && { priceSar: parsed.data.priceSar }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        userId: adminId,
        action: 'ADMIN_PACKAGE_UPDATED',
        details: JSON.stringify({ packageId: id, changes: parsed.data }),
      },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteParams,
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const adminId = auth.userId;
    const { id } = await context.params;

    const existing = await prisma.subscriptionPackage.findUnique({
      where: { id },
      select: { id: true, name: true, _count: { select: { userSubscriptions: true } } },
    });

    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'Package not found' } },
        { status: 404 },
      );
    }

    // Soft-delete if any subscriptions reference this package
    if (existing._count.userSubscriptions > 0) {
      const updated = await prisma.subscriptionPackage.update({
        where: { id },
        data: { isActive: false },
      });

      await prisma.auditLog.create({
        data: {
          id: randomUUID(),
          userId: adminId,
          action: 'ADMIN_PACKAGE_DEACTIVATED',
          details: JSON.stringify({
            packageId: id,
            name: existing.name,
            reason: 'in_use',
            subscriptionCount: existing._count.userSubscriptions,
          }),
        },
      });

      return NextResponse.json({
        data: {
          ...updated,
          message: `Package is used by ${existing._count.userSubscriptions} subscription(s). It has been deactivated instead of deleted.`,
        },
        error: null,
      });
    }

    // Hard delete — not in use
    await prisma.subscriptionPackage.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        userId: adminId,
        action: 'ADMIN_PACKAGE_DELETED',
        details: JSON.stringify({ packageId: id, name: existing.name }),
      },
    });

    return NextResponse.json({ data: { message: 'Package deleted successfully' }, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
