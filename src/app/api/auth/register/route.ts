import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { email, password, fullName, phone } = await req.json();
    if (!email || !password || !fullName) {
      return NextResponse.json({ data: null, error: { message: 'Email, password, and full name are required' } }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ data: null, error: { message: 'A user with this email already exists' } }, { status: 400 });
    }

    const passwordHash = bcrypt.hashSync(password, 10);

    // Prisma Transaction ensures atomic registration of user, profile, wallet, and loyalty account
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: 'PARENT',
        },
      });

      await tx.profile.create({
        data: {
          id: user.id,
          role: 'PARENT',
          fullName,
          phone,
        },
      });

      await tx.wallet.create({
        data: {
          userId: user.id,
          balanceSar: 0.00,
        },
      });

      await tx.loyaltyAccount.create({
        data: {
          userId: user.id,
          pointsBalance: 0,
        },
      });

      return user;
    });

    return NextResponse.json({
      data: {
        user: { id: result.id, email: result.email }
      },
      error: null
    });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
  }
}
