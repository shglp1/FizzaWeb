import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';

const ALLOWED_KEYS = [
  'pricePerKmSar',
  'extraRiderSameDropoffMultiplier',
  'maxTripGenerationDays',
  'dispatchBufferMinutes',
  'defaultLegDurationMinutes',
  'defaultTravelMinutesNoCoords',
  'supportPhone',
  'supportWhatsApp',
  'notificationLeadTimeMinutes',
  'loyaltyPointsPerSar',
  'loyaltyPointsOnSafetyApproval',
] as const;

type AllowedKey = (typeof ALLOWED_KEYS)[number];

const updateSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .refine(
    (obj) => Object.keys(obj).every((k) => (ALLOWED_KEYS as readonly string[]).includes(k)),
    { message: `Only allowed keys: ${ALLOWED_KEYS.join(', ')}` },
  );

export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const rows = await prisma.systemConfiguration.findMany({
      where: { key: { in: [...ALLOWED_KEYS] } },
      orderBy: { key: 'asc' },
    });

    return NextResponse.json({ data: rows, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const updates = parsed.data as Record<AllowedKey, string | number | boolean>;
    const now = new Date();
    const ops = Object.entries(updates).map(([key, value]) =>
      prisma.systemConfiguration.upsert({
        where: { key },
        update: { value, updatedAt: now },
        create: { key, value, updatedAt: now },
      }),
    );

    const results = await prisma.$transaction(ops);

    await prisma.auditLog.create({
      data: {
        userId: auth.userId,
        action: 'SYSTEM_CONFIG_UPDATED',
        details: JSON.stringify(updates),
      },
    });

    return NextResponse.json({ data: results, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
