import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const SESSION_COOKIE = 'fizza-session';
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export interface SessionPayload extends JWTPayload {
  userId: string;
  role: string;
  /** 'FAMILY' for parent accounts; 'DRIVER_PORTAL' for driver applicant/approved accounts. */
  registrationSource?: string;
}

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('SESSION_SECRET environment variable is not set');
  return new TextEncoder().encode(s);
}

export async function signToken(
  userId: string,
  role: string,
  registrationSource?: string,
): Promise<string> {
  const payload: { userId: string; role: string; registrationSource?: string } = { userId, role };
  if (registrationSource) payload.registrationSource = registrationSource;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Cookie options aligned with POST /api/auth/login */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE,
};
