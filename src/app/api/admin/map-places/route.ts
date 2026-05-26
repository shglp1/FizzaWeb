import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { mapPlaceCreateSchema } from '@/lib/validations/mapPlace';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() ?? '';
    const city = searchParams.get('city')?.trim() ?? '';
    const type = searchParams.get('type')?.trim() ?? '';
    const active = searchParams.get('active');
    const verified = searchParams.get('verified');

    const places = await prisma.mapPlace.findMany({
      where: {
        ...(city ? { city: { contains: city } } : {}),
        ...(type ? { type: type as never } : {}),
        ...(active === 'true' ? { isActive: true } : active === 'false' ? { isActive: false } : {}),
        ...(verified === 'true' ? { isVerified: true } : verified === 'false' ? { isVerified: false } : {}),
        ...(q
          ? {
              OR: [
                { nameAr: { contains: q } },
                { nameEn: { contains: q } },
                { city: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ isVerified: 'desc' }, { city: 'asc' }, { nameEn: 'asc' }],
    });

    return NextResponse.json({ data: places, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = mapPlaceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const d = parsed.data;
    const created = await prisma.mapPlace.create({
      data: {
        id: randomUUID(),
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        type: d.type,
        city: d.city,
        region: d.region?.trim() || null,
        country: d.country ?? 'SA',
        latitude: d.latitude,
        longitude: d.longitude,
        aliasesAr: d.aliasesAr ?? [],
        aliasesEn: d.aliasesEn ?? [],
        isActive: d.isActive ?? true,
        isVerified: d.isVerified ?? false,
        notes: d.notes?.trim() || null,
        createdById: auth.userId,
        updatedById: auth.userId,
      },
    });

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
