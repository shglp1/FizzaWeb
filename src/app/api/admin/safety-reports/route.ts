import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { safetyListQuerySchema } from '@/lib/validations/safety';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const raw = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = safetyListQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Invalid query' } },
        { status: 400 },
      );
    }

    const { page, limit, status, category, dateFrom, dateTo } = parsed.data;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59Z') } : {}),
      };
    }

    const [reports, total] = await Promise.all([
      prisma.safetyReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          category: true,
          description: true,
          status: true,
          adminResponse: true,
          reviewedAt: true,
          createdAt: true,
          user: { select: { fullName: true, phone: true, user: { select: { email: true } } } },
          trip: {
            select: {
              id: true,
              scheduledDate: true,
              pickupLocation: true,
              dropoffLocation: true,
              rider: { select: { id: true, name: true } },
              driver: { select: { id: true, profile: { select: { fullName: true, phone: true } } } },
            },
          },
          attachments: { select: { id: true, filePath: true } },
          reviewer: { select: { fullName: true } },
        },
      }),
      prisma.safetyReport.count({ where }),
    ]);

    return NextResponse.json({
      data: { reports, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      error: null,
    });
  } catch (error) {
    console.error('[GET /api/admin/safety-reports]', error);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}
