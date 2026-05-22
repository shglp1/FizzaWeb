import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const addOns = await prisma.addOn.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceSar: 'asc' }],
    });
    return NextResponse.json({ data: addOns, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
