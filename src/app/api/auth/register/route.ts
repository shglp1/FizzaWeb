import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validations/auth';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 'auth:register', RATE_LIMITS.register);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    const { email, password, fullName, phone } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      // Use upsert-equivalent: catch unique constraint and return generic error
      const user = await tx.user.create({
        data: { email, passwordHash, role: 'PARENT' },
      });

      await tx.profile.create({
        data: { id: user.id, role: 'PARENT', fullName, phone },
      });

      await tx.wallet.create({
        data: { userId: user.id, balanceSar: 0.0 },
      });

      await tx.loyaltyAccount.create({
        data: { userId: user.id, pointsBalance: 0 },
      });

      return user;
    });

    return NextResponse.json({
      data: { user: { id: result.id, email: result.email } },
      error: null,
    });
  } catch (error: unknown) {
    // P2002 is Prisma's unique constraint violation code
    const isPrismaUniqueError =
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002';

    if (isPrismaUniqueError) {
      // Return generic message to prevent email enumeration at registration
      return NextResponse.json(
        { data: null, error: { message: 'Registration failed. Please try again.' } },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
