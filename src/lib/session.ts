import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { verifyToken, SESSION_COOKIE, type SessionPayload } from './auth';

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

export type { SessionPayload };
