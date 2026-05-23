import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import type { AccountType } from '@/lib/adminUserTypes';
import { classifyUser } from '@/lib/adminUserClassify';

export type { AccountType };

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const search            = searchParams.get('search') ?? '';
    const role              = searchParams.get('role') ?? '';           // legacy compat
    const accountType       = searchParams.get('accountType') ?? '';   // preferred filter
    const applicationStatus = searchParams.get('applicationStatus') ?? '';
    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const skip  = (page - 1) * limit;

    // ── Build filter conditions (ANDed together) ────────────────────────────
    const conditions: Record<string, unknown>[] = [];

    if (accountType) {
      switch (accountType) {
        case 'ADMIN':
          conditions.push({ role: 'ADMIN' });
          break;
        case 'APPROVED_DRIVER':
          conditions.push({ role: 'DRIVER' });
          break;
        case 'DRIVER_APPLICANT':
          conditions.push({
            role: 'PARENT',
            OR: [
              { registrationSource: 'DRIVER_PORTAL' },
              { driverApplications: { some: {} } },
            ],
          });
          break;
        case 'FAMILY_PARENT':
          conditions.push({
            role: 'PARENT',
            registrationSource: 'FAMILY',
            driverApplications: { none: {} },
          });
          break;
      }
    } else if (role) {
      // Legacy role filter (kept for backward compat)
      conditions.push({ role });
    }

    // applicationStatus filter (fine-grained within DRIVER_APPLICANT)
    if (applicationStatus === 'NOT_SUBMITTED') {
      conditions.push({
        role: 'PARENT',
        registrationSource: 'DRIVER_PORTAL',
        driverApplications: { none: {} },
      });
    } else if (applicationStatus) {
      conditions.push({ driverApplications: { some: { status: applicationStatus } } });
    }

    if (search) {
      conditions.push({
        OR: [
          { fullName: { contains: search } },
          { phone:    { contains: search } },
          { user:     { email: { contains: search } } },
        ],
      });
    }

    const where = conditions.length > 0 ? { AND: conditions } : {};

    // ── Queries ─────────────────────────────────────────────────────────────
    const [
      profiles,
      total,
      adminCount,
      driverCount,
      applicantCount,
      familyParentCount,
    ] = await Promise.all([
      prisma.profile.findMany({
        where,
        select: {
          id:                 true,
          fullName:           true,
          role:               true,
          phone:              true,
          registrationSource: true,
          createdAt:          true,
          user:    { select: { email: true, createdAt: true } },
          wallet:  { select: { balanceSar: true } },
          _count:  { select: { userSubscriptions: true, riders: true } },
          driverApplications: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id:            true,
              status:        true,
              adminResponse: true,
              updatedAt:     true,
              createdAt:     true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.profile.count({ where }),
      // Global summary counts (always reflect the full dataset, ignoring current filters)
      prisma.profile.count({ where: { role: 'ADMIN' } }),
      prisma.profile.count({ where: { role: 'DRIVER' } }),
      prisma.profile.count({
        where: {
          role: 'PARENT',
          OR: [
            { registrationSource: 'DRIVER_PORTAL' },
            { driverApplications: { some: {} } },
          ],
        },
      }),
      prisma.profile.count({
        where: {
          role: 'PARENT',
          registrationSource: 'FAMILY',
          driverApplications: { none: {} },
        },
      }),
    ]);

    // ── Map + classify each profile ──────────────────────────────────────────
    const users = profiles.map((p) => {
      const app = p.driverApplications[0] ?? null;
      const src = p.registrationSource ?? 'FAMILY';
      const { accountType: at, driverState, displayRole } = classifyUser(p.role, src, app);
      return {
        id:                 p.id,
        fullName:           p.fullName,
        role:               p.role,
        phone:              p.phone ?? null,
        registrationSource: src,
        createdAt:          p.createdAt,
        user:               p.user,
        wallet:             p.wallet,
        _count:             p._count,
        driverApplication: app
          ? {
              id:            app.id,
              status:        app.status,
              adminResponse: app.adminResponse,
              updatedAt:     app.updatedAt.toISOString(),
              createdAt:     app.createdAt.toISOString(),
            }
          : null,
        accountType:  at,
        driverState,
        displayRole,
      };
    });

    return NextResponse.json({
      data: {
        users,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        summary: {
          admins:           adminCount,
          approvedDrivers:  driverCount,
          driverApplicants: applicantCount,
          familyParents:    familyParentCount,
        },
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
