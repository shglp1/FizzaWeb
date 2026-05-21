import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';

// Lightweight role endpoint — reads from JWT, no DB query
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ data: { id: auth.userId, role: auth.role }, error: null });
}
