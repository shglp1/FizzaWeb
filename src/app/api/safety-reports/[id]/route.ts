import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { safetyReportUpdateSchema } from '@/lib/validations/safety';

const REPORT_SELECT = {
  id: true,
  category: true,
  description: true,
  status: true,
  adminResponse: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { fullName: true } },
  trip: {
    select: {
      id: true,
      scheduledDate: true,
      pickupLocation: true,
      dropoffLocation: true,
      rider: { select: { name: true } },
      driver: { select: { profile: { select: { fullName: true } } } },
    },
  },
  attachments: { select: { id: true, filePath: true } },
  reviewer: { select: { fullName: true } },
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { userId, role } = auth;
    const { id } = await context.params;

    const report = await prisma.safetyReport.findUnique({
      where: { id },
      select: REPORT_SELECT,
    });

    if (!report) {
      return NextResponse.json({ data: null, error: { message: 'Report not found' } }, { status: 404 });
    }

    if (role !== 'ADMIN' && report.user == null) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    const fullReport = await prisma.safetyReport.findUnique({ where: { id }, select: { userId: true } });
    if (role !== 'ADMIN' && fullReport?.userId !== userId) {
      return NextResponse.json({ data: null, error: { message: 'Forbidden' } }, { status: 403 });
    }

    return NextResponse.json({ data: { report }, error: null });
  } catch (error) {
    console.error('[GET /api/safety-reports/[id]]', error);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const { userId } = auth;
    const { id } = await context.params;

    const existing = await prisma.safetyReport.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ data: null, error: { message: 'Report not found' } }, { status: 404 });
    }

    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        { data: null, error: { message: 'Only PENDING reports can be updated' } },
        { status: 409 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: { message: 'Invalid JSON body' } }, { status: 400 });
    }

    const parsed = safetyReportUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Validation error' } },
        { status: 400 },
      );
    }

    const { description, attachmentUrls } = parsed.data;

    await prisma.$transaction(async (tx) => {
      if (description) {
        await tx.safetyReport.update({ where: { id }, data: { description } });
      }

      if (attachmentUrls !== undefined) {
        // Replace attachments
        await tx.safetyReportAttachment.deleteMany({ where: { reportId: id } });
        if (attachmentUrls.length) {
          await tx.safetyReportAttachment.createMany({
            data: attachmentUrls.map((url) => ({ id: randomUUID(), reportId: id, filePath: url })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          userId,
          action: 'SAFETY_REPORT_UPDATED',
          details: JSON.stringify({ reportId: id }),
        },
      });
    });

    return NextResponse.json({ data: { reportId: id }, error: null });
  } catch (error) {
    console.error('[PATCH /api/safety-reports/[id]]', error);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}
