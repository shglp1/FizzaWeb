import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

async function getAuthUserId() {
  const cookieStore = await cookies();
  return cookieStore.get('fizza-session')?.value;
}

export async function GET() {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    // Scope check: Parent can access only their own riders
    const riders = await prisma.rider.findMany({
      where: { parentId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: riders, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });
    }

    const body = await req.json();
    const { id, action, name, relationship, school, grade, phone, specialNeeds, notes, isActive } = body;

    if (action === 'update' || id) {
      // Update existing rider
      const riderId = id;
      
      // Enforce authorization: verify the rider belongs to the logged-in parent
      const existingRider = await prisma.rider.findFirst({
        where: { id: riderId, parentId: userId },
      });

      if (!existingRider) {
        return NextResponse.json({ data: null, error: { message: 'Rider not found or permission denied' } }, { status: 403 });
      }

      const updatedRider = await prisma.rider.update({
        where: { id: riderId },
        data: {
          name: name !== undefined ? name : undefined,
          relationship: relationship !== undefined ? relationship : undefined,
          school: school !== undefined ? school : undefined,
          grade: grade !== undefined ? grade : undefined,
          phone: phone !== undefined ? phone : undefined,
          specialNeeds: specialNeeds !== undefined ? specialNeeds : undefined,
          notes: notes !== undefined ? notes : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
        },
      });

      return NextResponse.json({ data: updatedRider, error: null });
    } else {
      // Create new rider
      if (!name || !relationship) {
        return NextResponse.json({ data: null, error: { message: 'Name and relationship are required' } }, { status: 400 });
      }

      const newRider = await prisma.rider.create({
        data: {
          parentId: userId,
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
    }
  } catch (error: any) {
    return NextResponse.json({ data: null, error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
  }
}
