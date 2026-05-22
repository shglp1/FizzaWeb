import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { z } from 'zod';

const createAddOnSchema = z.object({
  name: z.string().min(1).max(100),
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

    const addOns = await prisma.addOn.findMany({
      where: includeInactive ? undefined : { isActive: true },
      select: {
        id: true,
        name: true,
        priceSar: true,
        description: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { subscriptionAddOns: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { priceSar: 'asc' }],
    });

    return NextResponse.json({ data: addOns, error: null });
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

    const parsed = createAddOnSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Validation error' } },
        { status: 400 },
      );
    }

    const addOn = await prisma.addOn.create({
      data: {
        id: randomUUID(),
        name: parsed.data.name,
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
        action: 'ADMIN_ADDON_CREATED',
        details: JSON.stringify({ addOnId: addOn.id, name: addOn.name, priceSar: addOn.priceSar }),
      },
    });

    return NextResponse.json({ data: addOn, error: null }, { status: 201 });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
