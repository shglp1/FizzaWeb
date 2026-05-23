/**
 * GET /api/admin/chat/blocks — list active chat blocks
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const blocks = await prisma.chatBlock.findMany({
      where: activeOnly ? { active: true } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: { select: { id: true, fullName: true, phone: true } },
        driver: { include: { profile: { select: { id: true, fullName: true } } } },
        blockedBy: { select: { fullName: true } },
      },
    });

    return NextResponse.json({ data: { blocks }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
