import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const SESSION_COOKIE = 'fizza-session';
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export interface SessionPayload extends JWTPayload {
  userId: string;
  role: string;
}

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error('SESSION_SECRET environment variable is not set');
  return new TextEncoder().encode(s);
}

export async function signToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ userId, role })
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
