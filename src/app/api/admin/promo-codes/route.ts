import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { promoCodeCreateSchema } from '@/lib/validations/promo';

export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const codes = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { redemptions: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json({ data: codes, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = promoCodeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { code, partnerName, discountPercent, maxUses, expiresAt, notes, isActive } = parsed.data;
    const normalized = code.trim().toUpperCase();

    const existing = await prisma.promoCode.findUnique({ where: { code: normalized } });
    if (existing) {
      return NextResponse.json({ data: null, error: { message: 'This code already exists' } }, { status: 409 });
    }

    const created = await prisma.promoCode.create({
      data: {
        id: randomUUID(),
        code: normalized,
        partnerName: partnerName?.trim() || null,
        discountPercent,
        maxUses: maxUses ?? null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        notes: notes?.trim() || null,
        isActive: isActive ?? true,
        createdById: auth.userId,
      },
    });

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
