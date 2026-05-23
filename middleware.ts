import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, SESSION_COOKIE } from '@/lib/auth';
// ─── Public routes (no auth required) ────────────────────────────────────────
// Driver landing + driver auth pages are public so unauthenticated visitors
// can discover and enter the driver funnel before creating an account.
const PUBLIC_PREFIXES = [
  '/',
  '/login',
  '/register',
  '/reset-password',
  '/verify',
  '/drive',           // driver landing page
  '/driver/login',    // driver-specific sign-in
  '/driver/register', // driver-specific sign-up
];

// ─── Protected routes (require valid session) ─────────────────────────────────
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

  // Public routes pass through immediately (driver landing + driver auth included)
  if (isPublic(pathname)) return NextResponse.next();

  // Non-protected routes pass through (static assets handled by matcher)
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

  // ADMIN visiting parent or driver pages → /admin
  const ADMIN_REDIRECT_PREFIXES = [
    '/dashboard',
    '/riders',
    '/subscriptions',
    '/trips',
    '/wallet',
    '/safety',
    '/driver/dashboard',
    '/driver-application',
  ];
  if (
    role === 'ADMIN' &&
    ADMIN_REDIRECT_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + '/'),
    )
  ) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  // DRIVER visiting parent dashboard → /driver/dashboard
  if (role === 'DRIVER' && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))) {
    return NextResponse.redirect(new URL('/driver/dashboard', req.url));
  }

  // DRIVER visiting driver-application → already approved, send to driver dashboard
  if (role === 'DRIVER' && (pathname === '/driver-application' || pathname.startsWith('/driver-application/'))) {
    return NextResponse.redirect(new URL('/driver/dashboard', req.url));
  }

  // Non-admin visiting /admin → forbidden (no admin shell)
  if (role !== 'ADMIN' && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    return NextResponse.redirect(new URL('/forbidden', req.url));
  }

  // PARENT visiting driver dashboard → /dashboard
  // (DRIVER applicants are PARENT role — they should not reach /driver/dashboard yet)
  if (role === 'PARENT' && (pathname === '/driver/dashboard' || pathname.startsWith('/driver/dashboard/'))) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except Next.js internals and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
