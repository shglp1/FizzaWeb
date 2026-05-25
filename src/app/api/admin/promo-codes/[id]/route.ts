import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { promoCodeUpdateSchema } from '@/lib/validations/promo';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await req.json();
    const parsed = promoCodeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ data: null, error: { message: 'Promo code not found' } }, { status: 404 });
    }

    const data = parsed.data;
    const updated = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(data.code != null ? { code: data.code.trim().toUpperCase() } : {}),
        ...(data.partnerName !== undefined ? { partnerName: data.partnerName?.trim() || null } : {}),
        ...(data.discountPercent != null ? { discountPercent: data.discountPercent } : {}),
        ...(data.maxUses !== undefined ? { maxUses: data.maxUses ?? null } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        ...(data.isActive != null ? { isActive: data.isActive } : {}),
      },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const code = await prisma.promoCode.findUnique({
      where: { id },
      include: {
        redemptions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: { select: { fullName: true, user: { select: { email: true } } } },
            subscription: { select: { id: true, package: { select: { name: true } } } },
          },
        },
      },
    });

    if (!code) {
      return NextResponse.json({ data: null, error: { message: 'Promo code not found' } }, { status: 404 });
    }

    return NextResponse.json({ data: code, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
