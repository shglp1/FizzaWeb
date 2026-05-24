import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { buildPaginationMeta, parsePaginationParams } from '@/lib/pagination';
import type { Prisma } from '@prisma/client';

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const isSuspended = searchParams.get('isSuspended');
    const available = searchParams.get('available');
    const search = searchParams.get('search') ?? '';
    const vehicleType = searchParams.get('vehicleType') ?? '';
    const city = searchParams.get('city') ?? '';
    const assignable = searchParams.get('assignable');
    const { page, limit, skip } = parsePaginationParams(searchParams, { maxLimit: 100 });

    if (assignable === 'true') {
      const drivers = await prisma.driver.findMany({
        where: { isSuspended: false, vehicleId: { not: null } },
        include: {
          profile: { select: { id: true, fullName: true, phone: true } },
          vehicle: { select: { model: true, plateNumber: true, color: true, capacity: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return NextResponse.json({ data: drivers, error: null });
    }

    const where: Prisma.DriverWhereInput = {};
    if (isSuspended === 'true') where.isSuspended = true;
    if (isSuspended === 'false') where.isSuspended = false;
    if (available === 'true') where.availability = true;
    if (available === 'false') where.availability = false;

    const profileWhere: Prisma.ProfileWhereInput = {};
    if (search) profileWhere.fullName = { contains: search };

    if (vehicleType || city) {
      profileWhere.driverApplications = {
        some: {
          status: 'APPROVED',
          ...(vehicleType ? { vehicleType: vehicleType as 'ECONOMY' | 'COMFORT' | 'FAMILY' | 'VAN' | 'BUS' | 'PREMIUM' } : {}),
          ...(city ? { city: { contains: city } } : {}),
        },
      };
    }

    if (Object.keys(profileWhere).length > 0) {
      where.profile = profileWhere;
    }

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        select: {
          id: true,
          availability: true,
          isSuspended: true,
          suspensionReason: true,
          rating: true,
          createdAt: true,
          profile: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              user: { select: { email: true } },
              driverApplications: {
                where: { status: 'APPROVED' },
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  vehicleType: true,
                  city: true,
                  serviceArea: true,
                  vehicleModel: true,
                  plateNumber: true,
                },
              },
            },
          },
          vehicle: { select: { model: true, plateNumber: true, color: true, capacity: true } },
          chatBlocks: {
            where: { active: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, reason: true, active: true, endsAt: true, createdAt: true },
          },
          _count: { select: { trips: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.driver.count({ where }),
    ]);

    const mapped = drivers.map((d) => ({
      ...d,
      approvedApplication: d.profile?.driverApplications?.[0] ?? null,
      activeChatBlock: d.chatBlocks[0] ?? null,
      chatBlocks: undefined,
      profile: d.profile
        ? {
            id: d.profile.id,
            fullName: d.profile.fullName,
            phone: d.profile.phone,
            user: d.profile.user,
          }
        : null,
    }));

    return NextResponse.json({
      data: {
        drivers: mapped,
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
