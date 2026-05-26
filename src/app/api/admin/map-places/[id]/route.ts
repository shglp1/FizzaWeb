import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { mapPlaceUpdateSchema } from '@/lib/validations/mapPlace';
import { buildMapPlaceUpdateData } from '@/lib/maps/mapPlaceAdminHelpers';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const place = await prisma.mapPlace.findUnique({ where: { id } });
    if (!place) {
      return NextResponse.json({ data: null, error: { message: 'Place not found' } }, { status: 404 });
    }
    return NextResponse.json({ data: place, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const existing = await prisma.mapPlace.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ data: null, error: { message: 'Place not found' } }, { status: 404 });
    }

    const body = await req.json();
    const parsed = mapPlaceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const updated = await prisma.mapPlace.update({
      where: { id },
      data: buildMapPlaceUpdateData(parsed.data, auth.userId, existing),
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
