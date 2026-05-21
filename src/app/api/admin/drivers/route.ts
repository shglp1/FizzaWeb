import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const drivers = await prisma.driver.findMany({
      where: { isSuspended: false, vehicleId: { not: null } },
      include: {
        profile: { select: { id: true, fullName: true, phone: true } },
        vehicle: { select: { model: true, plateNumber: true, color: true, capacity: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: drivers, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
