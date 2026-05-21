import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard','/riders','/subscriptions','/trips','/wallet','/safety','/notifications','/profile','/admin'];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = protectedRoutes.some((r) => path.startsWith(r));
  if (!isProtected) return NextResponse.next();

  const hasSession = req.cookies.get('fizza-session');
  if (!hasSession) return NextResponse.redirect(new URL('/login', req.url));

  if (path.startsWith('/admin')) {
    const role = req.cookies.get('fizza-role')?.value;
    if (role !== 'ADMIN' && role !== 'admin') return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
