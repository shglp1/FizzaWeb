import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import {
  createSupplier,
  getSupplierDashboard,
  isMultiVendorConfigured,
} from '@/lib/payments/myfatoorahSuppliers';
import { PaymentGatewayError } from '@/lib/payments/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteParams) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id: driverId } = await context.params;
    const profile = await prisma.driverPayProfile.findUnique({ where: { driverId } });
    return NextResponse.json({
      data: {
        profile,
        multiVendorConfigured: isMultiVendorConfigured(),
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

export async function POST(_req: Request, context: RouteParams) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { id: driverId } = await context.params;

    const driver = await prisma.driver.findUnique({
      where: { id: driverId },
      include: {
        profile: { include: { user: { select: { email: true } } } },
        payProfile: true,
      },
    });

    if (!driver?.profile) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver not found' } },
        { status: 404 },
      );
    }

    const payProfile = driver.payProfile;
    if (!payProfile?.bankIban || !payProfile.bankAccountHolderName) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver has not submitted payout bank details' } },
        { status: 400 },
      );
    }

    if (!isMultiVendorConfigured()) {
      return NextResponse.json(
        { data: null, error: { message: 'MyFatoorah Multi-Vendors is not configured' } },
        { status: 503 },
      );
    }

    let supplierCode = payProfile.myfatoorahSupplierCode;
    let supplierStatus = payProfile.supplierStatus;
    let supplierStatusNote = payProfile.supplierStatusNote;

    if (!supplierCode) {
      try {
        const created = await createSupplier({
          supplierName: driver.profile.fullName,
          mobile: driver.profile.phone ?? '0500000000',
          email: driver.profile.user.email,
          bankId: payProfile.bankId ?? process.env.MYFATOORAH_DEFAULT_BANK_ID ?? '1',
          bankAccountHolderName: payProfile.bankAccountHolderName,
          bankAccount: payProfile.bankAccountNumber ?? payProfile.bankIban.slice(-10),
          iban: payProfile.bankIban,
        });
        supplierCode = created.SupplierCode;
        supplierStatus = 'PENDING';
        supplierStatusNote = 'Supplier created in MyFatoorah — awaiting approval';
      } catch (err) {
        const message = err instanceof PaymentGatewayError
          ? err.providerMessage ?? err.message
          : err instanceof Error ? err.message : 'Supplier creation failed';
        return NextResponse.json({ data: null, error: { message } }, { status: 502 });
      }
    }

    if (supplierCode) {
      try {
        const dashboard = await getSupplierDashboard(supplierCode);
        if (dashboard.IsApproved) {
          supplierStatus = 'APPROVED';
          supplierStatusNote = 'MyFatoorah supplier approved for automated payouts';
        } else if (dashboard.IsActive === false) {
          supplierStatus = 'REJECTED';
          supplierStatusNote = 'MyFatoorah supplier inactive or rejected';
        } else {
          supplierStatus = 'PENDING';
          supplierStatusNote = 'MyFatoorah supplier pending approval';
        }
      } catch {
        // Keep existing status if dashboard lookup fails
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.driverPayProfile.update({
        where: { driverId },
        data: {
          myfatoorahSupplierCode: supplierCode,
          supplierStatus,
          supplierStatusNote,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.userId,
          action: 'DRIVER_SUPPLIER_SYNCED',
          details: JSON.stringify({ driverId, supplierCode, supplierStatus }),
        },
      });

      return row;
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
