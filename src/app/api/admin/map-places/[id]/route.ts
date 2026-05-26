import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { mapPlaceUpdateSchema } from '@/lib/validations/mapPlace';

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

    const d = parsed.data;
    const updated = await prisma.mapPlace.update({
      where: { id },
      data: {
        ...(d.nameAr != null ? { nameAr: d.nameAr } : {}),
        ...(d.nameEn != null ? { nameEn: d.nameEn } : {}),
        ...(d.type != null ? { type: d.type } : {}),
        ...(d.city != null ? { city: d.city } : {}),
        ...(d.region !== undefined ? { region: d.region?.trim() || null } : {}),
        ...(d.country != null ? { country: d.country } : {}),
        ...(d.latitude != null ? { latitude: d.latitude } : {}),
        ...(d.longitude != null ? { longitude: d.longitude } : {}),
        ...(d.aliasesAr !== undefined ? { aliasesAr: d.aliasesAr ?? [] } : {}),
        ...(d.aliasesEn !== undefined ? { aliasesEn: d.aliasesEn ?? [] } : {}),
        ...(d.isActive != null ? { isActive: d.isActive } : {}),
        ...(d.isVerified != null ? { isVerified: d.isVerified } : {}),
        ...(d.notes !== undefined ? { notes: d.notes?.trim() || null } : {}),
        updatedById: auth.userId,
      },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
