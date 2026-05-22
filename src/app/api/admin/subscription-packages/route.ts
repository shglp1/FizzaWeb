import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const createPackageSchema = z.object({
  name: z.string().min(1).max(100),
  billingCycle: z.string().min(1).max(50),
  priceSar: z.number().positive(),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const packages = await prisma.subscriptionPackage.findMany({
      where: includeInactive ? undefined : { isActive: true },
      select: {
        id: true,
        name: true,
        billingCycle: true,
        priceSar: true,
        description: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { userSubscriptions: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { priceSar: 'asc' }],
    });

    return NextResponse.json({ data: packages, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const adminId = auth.userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid JSON body' } },
        { status: 400 },
      );
    }

    const parsed = createPackageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Validation error' } },
        { status: 400 },
      );
    }

    const pkg = await prisma.subscriptionPackage.create({
      data: {
        id: randomUUID(),
        name: parsed.data.name,
        billingCycle: parsed.data.billingCycle,
        priceSar: parsed.data.priceSar,
        description: parsed.data.description ?? null,
        sortOrder: parsed.data.sortOrder ?? null,
        isActive: parsed.data.isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        userId: adminId,
        action: 'ADMIN_PACKAGE_CREATED',
        details: JSON.stringify({ packageId: pkg.id, name: pkg.name, priceSar: pkg.priceSar }),
      },
    });

    return NextResponse.json({ data: pkg, error: null }, { status: 201 });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
