import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { buildMapPlaceCreateData } from '@/lib/maps/mapPlaceAdminHelpers';

const actionSchema = z.object({
  action: z.enum(['IGNORE', 'CONVERT']),
  label: z.string().trim().min(2).max(200).optional(),
  nameAr: z.string().trim().min(2).max(200).optional(),
  nameEn: z.string().trim().min(2).max(200).optional(),
  type: z
    .enum(['DISTRICT', 'SCHOOL', 'UNIVERSITY', 'MOSQUE', 'HOSPITAL', 'LANDMARK', 'STREET', 'BUILDING', 'GATE', 'OTHER'])
    .optional(),
  city: z.string().trim().min(2).max(120).optional(),
  adminNotes: z.string().max(2000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const review = await prisma.mapLocationReview.findUnique({ where: { id } });
    if (!review) {
      return NextResponse.json({ data: null, error: { message: 'Review not found' } }, { status: 404 });
    }

    const body = await req.json();
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    if (parsed.data.action === 'IGNORE') {
      const updated = await prisma.mapLocationReview.update({
        where: { id },
        data: {
          status: 'IGNORED',
          reviewedById: auth.userId,
          adminNotes: parsed.data.adminNotes?.trim() || review.adminNotes,
        },
      });
      return NextResponse.json({ data: updated, error: null });
    }

    const label = parsed.data.label?.trim() || review.label;
    const nameEn = parsed.data.nameEn?.trim() || label;
    const nameAr = parsed.data.nameAr?.trim() || label;
    const createData = buildMapPlaceCreateData(
      {
        nameAr,
        nameEn,
        type: parsed.data.type ?? 'LANDMARK',
        city: parsed.data.city ?? 'Unknown',
        country: 'SA',
        latitude: Number(review.latitude),
        longitude: Number(review.longitude),
        aliasesAr: [],
        aliasesEn: [],
        isActive: true,
        isVerified: true,
        notes: `Converted from subscription location review ${review.id}`,
      },
      auth.userId,
    );

    const result = await prisma.$transaction(async (tx) => {
      const place = await tx.mapPlace.create({ data: { id: randomUUID(), ...createData } });
      const updatedReview = await tx.mapLocationReview.update({
        where: { id },
        data: {
          status: 'CONVERTED',
          convertedMapPlaceId: place.id,
          reviewedById: auth.userId,
          label,
          adminNotes: parsed.data.adminNotes?.trim() || review.adminNotes,
        },
      });
      return { review: updatedReview, place };
    });

    return NextResponse.json({ data: result, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
