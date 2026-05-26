import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { mapPlaceCreateSchema } from '@/lib/validations/mapPlace';
import { listMapPlacesPaginated, getMapPlaceCounts } from '@/lib/maps/localPlaceSearch';
import { buildMapPlaceCreateData } from '@/lib/maps/mapPlaceAdminHelpers';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    const q = searchParams.get('query')?.trim() ?? searchParams.get('q')?.trim() ?? '';
    const city = searchParams.get('city')?.trim() ?? '';
    const type = searchParams.get('type')?.trim() ?? '';
    const active = searchParams.get('active') ?? '';
    const verified = searchParams.get('verified') ?? '';
    const includeStats = searchParams.get('stats') === '1';

    const result = await listMapPlacesPaginated({
      q: q || undefined,
      city: city || undefined,
      type: type || undefined,
      active: active || undefined,
      verified: verified || undefined,
      page,
      limit,
    });

    const stats = includeStats ? await getMapPlaceCounts() : undefined;

    return NextResponse.json({
      data: { ...result, stats },
      error: null,
    });
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

    const created = await prisma.mapPlace.create({
      data: {
        id: randomUUID(),
        ...buildMapPlaceCreateData(parsed.data, auth.userId),
      },
    });

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
