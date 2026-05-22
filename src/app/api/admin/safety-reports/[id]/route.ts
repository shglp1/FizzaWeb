import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { adminSafetyReviewSchema } from '@/lib/validations/safety';

const STATUS_MAP = {
  APPROVE: 'APPROVED',
  REJECT: 'REJECTED',
  RESOLVE: 'RESOLVED',
} as const;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const adminId = auth.userId;
    const { id } = await context.params;

    const report = await prisma.safetyReport.findUnique({
      where: { id },
      select: { id: true, status: true, userId: true },
    });

    if (!report) {
      return NextResponse.json({ data: null, error: { message: 'Report not found' } }, { status: 404 });
    }

    if (report.status === 'RESOLVED') {
      return NextResponse.json(
        { data: null, error: { message: 'This report has already been resolved' } },
        { status: 409 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ data: null, error: { message: 'Invalid JSON body' } }, { status: 400 });
    }

    const parsed = adminSafetyReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.errors[0]?.message ?? 'Validation error' } },
        { status: 400 },
      );
    }

    const { action, adminResponse } = parsed.data;
    const newStatus = STATUS_MAP[action];
    const now = new Date();

    // Fetch loyalty points config before transaction
    let loyaltyPointsOnApproval = 0;
    if (action === 'APPROVE' && report.userId) {
      const loyaltyRow = await prisma.systemConfiguration.findUnique({
        where: { key: 'loyaltyPointsOnSafetyApproval' },
      });
      if (typeof loyaltyRow?.value === 'number' && loyaltyRow.value > 0) {
        loyaltyPointsOnApproval = loyaltyRow.value;
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.safetyReport.update({
        where: { id },
        data: {
          status: newStatus,
          adminResponse: adminResponse ?? null,
          reviewedBy: adminId,
          reviewedAt: now,
        },
      });

      // Award loyalty points on approval if configured
      if (action === 'APPROVE' && report.userId && loyaltyPointsOnApproval > 0) {
        const account = await tx.loyaltyAccount.upsert({
          where: { userId: report.userId },
          create: { userId: report.userId, pointsBalance: loyaltyPointsOnApproval },
          update: { pointsBalance: { increment: loyaltyPointsOnApproval } },
          select: { id: true },
        });
        await tx.loyaltyTransaction.create({
          data: {
            accountId: account.id,
            points: loyaltyPointsOnApproval,
            reason: `Safety report approved (report ID: ${id})`,
          },
        });
      }

      if (report.userId) {
        const notifMessages: Record<typeof action, { title: string; message: string }> = {
          APPROVE: {
            title: 'Safety Report Approved',
            message: loyaltyPointsOnApproval > 0
              ? `Your safety report has been approved. You earned ${loyaltyPointsOnApproval} loyalty points. Thank you for helping keep our community safe.`
              : 'Your safety report has been reviewed and approved. Thank you for helping keep our community safe.',
          },
          REJECT: {
            title: 'Safety Report Update',
            message: adminResponse
              ? `Your safety report was reviewed: ${adminResponse}`
              : 'Your safety report has been reviewed.',
          },
          RESOLVE: {
            title: 'Safety Report Resolved',
            message: adminResponse
              ? `Your safety report has been resolved: ${adminResponse}`
              : 'Your safety report has been marked as resolved.',
          },
        };

        const { title, message } = notifMessages[action];
        await tx.notification.create({
          data: {
            id: randomUUID(),
            userId: report.userId,
            title,
            message,
            type: 'SAFETY',
          },
        });
      }

      const auditAction =
        action === 'APPROVE'
          ? 'SAFETY_REPORT_APPROVED'
          : action === 'REJECT'
          ? 'SAFETY_REPORT_REJECTED'
          : 'SAFETY_REPORT_RESOLVED';

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          userId: adminId,
          action: auditAction,
          details: JSON.stringify({ reportId: id, reporterUserId: report.userId, adminResponse }),
        },
      });
    });

    return NextResponse.json({ data: { reportId: id, status: newStatus }, error: null });
  } catch (error) {
    console.error('[PATCH /api/admin/safety-reports/[id]]', error);
    return NextResponse.json({ data: null, error: { message: 'Internal server error' } }, { status: 500 });
  }
}
