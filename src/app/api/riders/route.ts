import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

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
    const { id, action, name, relationship, school, grade, phone, specialNeeds, notes, isActive } =
      body;

    if (action === 'update' || id) {
      const existingRider = await prisma.rider.findFirst({
        where: { id, parentId: auth.userId },
      });

      if (!existingRider) {
        return NextResponse.json(
          { data: null, error: { message: 'Rider not found or permission denied' } },
          { status: 403 },
        );
      }

      const updatedRider = await prisma.rider.update({
        where: { id },
        data: {
          name: name ?? undefined,
          relationship: relationship ?? undefined,
          school: school ?? undefined,
          grade: grade ?? undefined,
          phone: phone ?? undefined,
          specialNeeds: specialNeeds ?? undefined,
          notes: notes ?? undefined,
          isActive: isActive ?? undefined,
        },
      });

      return NextResponse.json({ data: updatedRider, error: null });
    }

    if (!name || !relationship) {
      return NextResponse.json(
        { data: null, error: { message: 'Name and relationship are required' } },
        { status: 400 },
      );
    }

    const newRider = await prisma.rider.create({
      data: {
        parentId: auth.userId,
        name,
        relationship,
        school,
        grade,
        phone,
        specialNeeds: !!specialNeeds,
        notes,
        isActive: isActive !== undefined ? !!isActive : true,
      },
    });

    return NextResponse.json({ data: newRider, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
