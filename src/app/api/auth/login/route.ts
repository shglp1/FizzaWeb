import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ data: null, error: { message: 'Email and password are required' } }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return NextResponse.json({ data: null, error: { message: 'Invalid email or password' } }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set('fizza-session', user.id, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
    cookieStore.set('fizza-role', user.role, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return NextResponse.json({
      data: {
        user: { id: user.id, email: user.email, role: user.role },
        session: { access_token: user.id, user: { id: user.id, email: user.email } }
      },
      error: null
    });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
  }
}
