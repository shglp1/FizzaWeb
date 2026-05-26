import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/session';
import { runMapDiagnostics } from '@/lib/maps/diagnostics';

export async function GET() {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const data = await runMapDiagnostics();
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Internal Server Error' } }, { status: 500 });
  }
}
