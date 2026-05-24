import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { buildPaginationMeta, parsePaginationParams } from '@/lib/pagination';
import { auditActionsForSeverity, type AuditSeverity } from '@/lib/ui/adminAudit';
import type { Prisma } from '@prisma/client';
export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') ?? '';
    const action = searchParams.get('action') ?? '';
    const dateFrom = searchParams.get('dateFrom') ?? '';
    const dateTo = searchParams.get('dateTo') ?? '';
    const actor = searchParams.get('actor') ?? '';
    const severity = searchParams.get('severity') ?? '';
    const { page, limit, skip } = parsePaginationParams(searchParams);

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action };
    if (actor) where.user = { fullName: { contains: actor } };
    if (severity && ['info', 'success', 'warning', 'danger', 'admin'].includes(severity)) {
      const sev = severity as AuditSeverity;
      if (sev === 'admin') {
        where.OR = [
          { action: { startsWith: 'ADMIN_' } },
          { action: { startsWith: 'SYSTEM_' } },
          ...(auditActionsForSeverity('admin').length
            ? [{ action: { in: auditActionsForSeverity('admin') } }]
            : []),
        ];
      } else {
        const actions = auditActionsForSeverity(sev);
        if (actions.length > 0) where.action = { in: actions };
        else if (sev === 'info') {
          where.NOT = {
            OR: [
              { action: { startsWith: 'ADMIN_' } },
              { action: { startsWith: 'SYSTEM_' } },
              { action: { in: [...auditActionsForSeverity('danger'), ...auditActionsForSeverity('warning'), ...auditActionsForSeverity('success'), ...auditActionsForSeverity('admin')] } },
            ],
          };
        }
      }
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo + 'T23:59:59Z');
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          details: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { id: true, fullName: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      data: {
        logs,
        meta: buildPaginationMeta(page, limit, total),
      },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
