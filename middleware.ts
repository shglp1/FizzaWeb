import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, SESSION_COOKIE } from '@/lib/auth';

const protectedRoutes = [
  '/dashboard',
  '/riders',
  '/subscriptions',
  '/trips',
  '/tracking',
  '/wallet',
  '/safety',
  '/notifications',
  '/profile',
  '/admin',
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  // Verify signature — role comes from the signed payload, not a plain cookie
  const session = await verifyToken(token);
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  if (pathname.startsWith('/admin') && session.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
