import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { riderCreateSchema, riderUpdateSchema } from '@/lib/validations/rider';

function getIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const riders = await prisma.rider.findMany({
      where: { parentId: auth.userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: riders, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = riderCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const rider = await prisma.rider.create({
      data: { parentId: auth.userId, ...parsed.data },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'RIDER_CREATED',
        details: JSON.stringify({ riderId: rider.id, name: rider.name }),
        ipAddress: getIp(req),
      },
    });

    return NextResponse.json({ data: rider, error: null }, { status: 201 });
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
    const parsed = riderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { id, ...updates } = parsed.data;

    const existing = await prisma.rider.findFirst({
      where: { id, parentId: auth.userId },
    });
    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'Rider not found or permission denied' } },
        { status: 403 },
      );
    }

    const rider = await prisma.rider.update({
      where: { id },
      data: Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined),
      ),
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'RIDER_UPDATED',
        details: JSON.stringify({ riderId: id, updatedFields: Object.keys(updates) }),
        ipAddress: getIp(req),
      },
    });

    return NextResponse.json({ data: rider, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { data: null, error: { message: 'Rider ID is required' } },
        { status: 400 },
      );
    }

    const existing = await prisma.rider.findFirst({
      where: { id, parentId: auth.userId },
    });
    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'Rider not found or permission denied' } },
        { status: 403 },
      );
    }

    // Soft delete — deactivate rather than hard delete to preserve trip history
    const rider = await prisma.rider.update({
      where: { id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'RIDER_DEACTIVATED',
        details: JSON.stringify({ riderId: id, name: existing.name }),
        ipAddress: getIp(req),
      },
    });

    return NextResponse.json({ data: rider, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
