import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const packages = await prisma.subscriptionPackage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceSar: 'asc' }],
    });
    return NextResponse.json(
      { data: packages, error: null },
      {
        headers: {
          // Short private TTL: prices can change, browsers may cache briefly.
          // CDN must not cache because prices are admin-controlled.
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
