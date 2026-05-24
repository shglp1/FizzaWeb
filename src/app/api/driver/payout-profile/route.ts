import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

const SA_IBAN_REGEX = /^SA[0-9]{22}$/i;

const updateSchema = z.object({
  bankAccountHolderName: z.string().min(2).max(120),
  bankIban: z.string().regex(SA_IBAN_REGEX, 'Enter a valid Saudi IBAN (SA + 22 digits)'),
  bankAccountNumber: z.string().min(4).max(34).optional(),
  bankId: z.string().min(1).max(10).optional(),
});

export async function GET() {
  try {
    const auth = await requireRole(['DRIVER']);
    if (auth instanceof NextResponse) return auth;

    const driver = await prisma.driver.findFirst({
      where: { profileId: auth.userId },
      select: { id: true },
    });
    if (!driver) {
      return NextResponse.json({ data: null, error: null });
    }

    const profile = await prisma.driverPayProfile.findUnique({ where: { driverId: driver.id } });
    return NextResponse.json({ data: profile, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireRole(['DRIVER']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const driver = await prisma.driver.findFirst({
      where: { profileId: auth.userId },
      include: { profile: { include: { user: { select: { email: true } } } } },
    });
    if (!driver) {
      return NextResponse.json(
        { data: null, error: { message: 'Driver profile not found' } },
        { status: 404 },
      );
    }

    const { bankAccountHolderName, bankIban, bankAccountNumber, bankId } = parsed.data;

    const profile = await prisma.driverPayProfile.upsert({
      where: { driverId: driver.id },
      update: {
        bankAccountHolderName,
        bankIban: bankIban.toUpperCase(),
        bankAccountNumber: bankAccountNumber ?? null,
        bankId: bankId ?? process.env.MYFATOORAH_DEFAULT_BANK_ID ?? '1',
        supplierStatus: 'PENDING',
        supplierStatusNote: 'Awaiting MyFatoorah supplier sync by admin',
      },
      create: {
        driverId: driver.id,
        bankAccountHolderName,
        bankIban: bankIban.toUpperCase(),
        bankAccountNumber: bankAccountNumber ?? bankIban.slice(-10),
        bankId: bankId ?? process.env.MYFATOORAH_DEFAULT_BANK_ID ?? '1',
        supplierStatus: 'PENDING',
        supplierStatusNote: 'Awaiting MyFatoorah supplier sync by admin',
      },
    });

    return NextResponse.json({ data: profile, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
