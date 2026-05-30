import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  signToken,
  verifyToken,
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  type SessionPayload,
} from './auth';

/** Issue JWT and set the httpOnly session cookie (same as login). */
export async function setSessionCookie(
  userId: string,
  role: string,
  registrationSource?: string,
): Promise<void> {
  const token = await signToken(userId, role, registrationSource);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<SessionPayload | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { data: null, error: { message: 'Unauthorized' } },
      { status: 401 },
    );
  }
  return user;
}

export async function requireRole(roles: string[]): Promise<SessionPayload | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (!roles.includes(result.role)) {
    return NextResponse.json(
      { data: null, error: { message: 'Forbidden' } },
      { status: 403 },
    );
  }
  return result;
}

/**
 * Authenticated family-parent access.
 *
 * Driver-applicant accounts are stored as role PARENT with
 * registrationSource = 'DRIVER_PORTAL' until an admin approves them. The page
 * middleware confines them to an allow-list, but API routes bypass middleware,
 * so parent-only APIs (wallet, subscriptions, riders, payments, parent trips)
 * must enforce the same restriction server-side. This rejects driver-portal
 * applicants while allowing genuine FAMILY parents.
 */
export async function requireFamilyParent(): Promise<SessionPayload | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (result.role === 'PARENT' && result.registrationSource === 'DRIVER_PORTAL') {
    return NextResponse.json(
      { data: null, error: { message: 'Forbidden' } },
      { status: 403 },
    );
  }
  return result;
}

export type { SessionPayload };
