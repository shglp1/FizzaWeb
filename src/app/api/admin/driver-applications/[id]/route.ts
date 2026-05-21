import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { adminReviewSchema } from '@/lib/validations/driverApplication';

function getIp(req: Request): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    null
  );
}

const NOTIFICATION_MESSAGES: Record<string, { title: string; message: string; type: string }> = {
  APPROVE: {
    title: 'Driver Application Approved',
    message: 'Your driver application has been approved.',
    type: 'DRIVER_APPLICATION_APPROVED',
  },
  REJECT: {
    title: 'Driver Application Rejected',
    message: 'Your driver application was rejected. Please review the reason and resubmit.',
    type: 'DRIVER_APPLICATION_REJECTED',
  },
  NEEDS_CHANGES: {
    title: 'Driver Application Needs Changes',
    message: 'Your driver application needs changes. Please review the admin notes and resubmit.',
    type: 'DRIVER_APPLICATION_NEEDS_CHANGES',
  },
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id } = await params;
    const body = await req.json();
    const parsed = adminReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { action, adminResponse } = parsed.data;
    const ip = getIp(req);

    const application = await prisma.driverApplication.findUnique({ where: { id } });
    if (!application) {
      return NextResponse.json(
        { data: null, error: { message: 'Application not found' } },
        { status: 404 },
      );
    }

    if (action === 'APPROVE') {
      // Run all approval side-effects in one transaction
      await prisma.$transaction(async (tx) => {
        // Upsert Vehicle by plate number
        const vehicle = await tx.vehicle.upsert({
          where: { plateNumber: application.plateNumber },
          create: {
            model: `${application.vehicleBrand} ${application.vehicleModel}`,
            plateNumber: application.plateNumber,
            color: application.vehicleColor,
            capacity: application.vehicleCapacity,
          },
          update: {
            model: `${application.vehicleBrand} ${application.vehicleModel}`,
            color: application.vehicleColor,
            capacity: application.vehicleCapacity,
          },
        });

        // Upsert Driver linked to the applicant profile
        const existingDriver = await tx.driver.findFirst({
          where: { profileId: application.userId },
        });

        if (existingDriver) {
          await tx.driver.update({
            where: { id: existingDriver.id },
            data: { vehicleId: vehicle.id, isSuspended: false },
          });
        } else {
          await tx.driver.create({
            data: {
              profileId: application.userId,
              vehicleId: vehicle.id,
              availability: true,
            },
          });
        }

        // Promote user role to DRIVER
        await tx.user.update({
          where: { id: application.userId },
          data: { role: 'DRIVER' },
        });

        // Update application status
        await tx.driverApplication.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewedBy: auth.userId,
            reviewedAt: new Date(),
            adminResponse: adminResponse ?? null,
          },
        });

        // Notify applicant
        await tx.notification.create({
          data: {
            userId: application.userId,
            title: NOTIFICATION_MESSAGES.APPROVE.title,
            message: NOTIFICATION_MESSAGES.APPROVE.message,
            type: NOTIFICATION_MESSAGES.APPROVE.type,
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            userId: auth.userId,
            action: 'DRIVER_APPLICATION_APPROVED',
            details: JSON.stringify({ applicationId: id, applicantId: application.userId }),
            ipAddress: ip,
          },
        });
      });
    } else {
      const newStatus = action === 'REJECT' ? 'REJECTED' : 'NEEDS_CHANGES';
      const auditAction =
        action === 'REJECT' ? 'DRIVER_APPLICATION_REJECTED' : 'DRIVER_APPLICATION_NEEDS_CHANGES';

      await prisma.$transaction(async (tx) => {
        await tx.driverApplication.update({
          where: { id },
          data: {
            status: newStatus,
            reviewedBy: auth.userId,
            reviewedAt: new Date(),
            adminResponse: adminResponse ?? null,
          },
        });

        await tx.notification.create({
          data: {
            userId: application.userId,
            title: NOTIFICATION_MESSAGES[action].title,
            message: NOTIFICATION_MESSAGES[action].message,
            type: NOTIFICATION_MESSAGES[action].type,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: auth.userId,
            action: auditAction,
            details: JSON.stringify({
              applicationId: id,
              applicantId: application.userId,
              reason: adminResponse,
            }),
            ipAddress: ip,
          },
        });
      });
    }

    const updated = await prisma.driverApplication.findUnique({ where: { id } });
    return NextResponse.json({ data: { application: updated }, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
