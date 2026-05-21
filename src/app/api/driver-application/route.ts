import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';
import { driverApplicationSchema } from '@/lib/validations/driverApplication';

function getIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const application = await prisma.driverApplication.findFirst({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: { application }, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    // Prevent duplicate active applications
    const existing = await prisma.driverApplication.findFirst({
      where: {
        userId: auth.userId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (existing) {
      return NextResponse.json(
        {
          data: null,
          error: {
            message:
              existing.status === 'APPROVED'
                ? 'Your driver application is already approved.'
                : 'You already have a pending application under review.',
          },
        },
        { status: 409 },
      );
    }

    const body = await req.json();
    const parsed = driverApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const application = await prisma.driverApplication.create({
      data: {
        userId: auth.userId,
        ...parsed.data,
        status: 'PENDING',
        submittedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'DRIVER_APPLICATION_SUBMITTED',
        details: JSON.stringify({ applicationId: application.id }),
        ipAddress: getIp(req),
      },
    });

    return NextResponse.json({ data: { application }, error: null }, { status: 201 });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const existing = await prisma.driverApplication.findFirst({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      return NextResponse.json(
        { data: null, error: { message: 'No application found to update' } },
        { status: 404 },
      );
    }

    if (existing.status === 'APPROVED') {
      return NextResponse.json(
        { data: null, error: { message: 'Approved applications cannot be edited.' } },
        { status: 403 },
      );
    }

    if (existing.status === 'PENDING') {
      return NextResponse.json(
        { data: null, error: { message: 'Application is under review and cannot be edited.' } },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = driverApplicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const application = await prisma.driverApplication.update({
      where: { id: existing.id },
      data: {
        ...parsed.data,
        status: 'PENDING',
        resubmittedAt: new Date(),
        adminResponse: null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'DRIVER_APPLICATION_RESUBMITTED',
        details: JSON.stringify({ applicationId: existing.id }),
        ipAddress: getIp(req),
      },
    });

    return NextResponse.json({ data: { application }, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
