import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, SESSION_COOKIE } from '@/lib/auth';
import { getDashboardPathForRole } from '@/lib/roleRoutes';

// Routes that never require authentication
const PUBLIC_PREFIXES = ['/', '/login', '/register', '/reset-password', '/verify'];

// Route prefixes that require an authenticated session
const PROTECTED_PREFIXES = [
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
  '/driver',
  '/driver-application',
  '/forbidden',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || (p !== '/' && pathname.startsWith(p + '/')),
  );
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public routes through immediately
  if (isPublic(pathname)) return NextResponse.next();

  // Only intercept protected page routes
  if (!isProtected(pathname)) return NextResponse.next();

  // ── Require valid session ──────────────────────────────────────────────────
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const url = new URL('/login', req.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  const session = await verifyToken(token);
  if (!session) {
    const url = new URL('/login', req.url);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  const role = session.role;

  // ── Role-based routing ────────────────────────────────────────────────────
  // ADMIN visiting parent dashboard → /admin
  if (role === 'ADMIN' && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }
  // ADMIN visiting driver dashboard → /admin
  if (role === 'ADMIN' && (pathname === '/driver/dashboard' || pathname.startsWith('/driver/dashboard/'))) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  // DRIVER visiting parent dashboard → /driver/dashboard
  if (role === 'DRIVER' && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    return NextResponse.redirect(new URL('/driver/dashboard', req.url));
  }

  // PARENT/DRIVER visiting admin → their dashboard
  if (role !== 'ADMIN' && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL(getDashboardPathForRole(role), req.url));
  }

  // PARENT visiting driver dashboard → /dashboard
  if (role === 'PARENT' && (pathname === '/driver/dashboard' || pathname.startsWith('/driver/dashboard/'))) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
