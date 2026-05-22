import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { signToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import { loginSchema } from '@/lib/validations/auth';
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rateLimit';
import bcrypt from 'bcryptjs';

const INVALID_CREDENTIALS = 'Invalid email or password';

export async function POST(req: Request) {
  const rl = checkRateLimit(req, 'auth:login', RATE_LIMITS.login);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      // Return generic message — don't hint at which field failed
      return NextResponse.json(
        { data: null, error: { message: INVALID_CREDENTIALS } },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always run bcrypt.compare to prevent timing-based email enumeration
    const passwordHash = user?.passwordHash ?? '$2b$10$invalidhashtopreventtimingattack';
    const validPassword = await bcrypt.compare(password, passwordHash);

    if (!user || !validPassword) {
      return NextResponse.json(
        { data: null, error: { message: INVALID_CREDENTIALS } },
        { status: 401 },
      );
    }

    const token = await signToken(user.id, user.role);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return NextResponse.json({
      data: { user: { id: user.id, email: user.email, role: user.role } },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
