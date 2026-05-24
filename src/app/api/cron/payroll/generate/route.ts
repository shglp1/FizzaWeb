/**
 * GET /api/cron/payroll/generate
 * Generates payroll for the previous calendar month.
 * Authorization: Bearer CRON_SECRET
 */
import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron/verifyCronSecret';
import { generatePreviousMonthPayrollCron } from '@/lib/payroll/generatePayrollRun';

export async function GET(req: Request) {
  try {
    const gate = verifyCronSecret(req);
    if (!gate.ok) return gate.response;

    const result = await generatePreviousMonthPayrollCron();
    return NextResponse.json({ data: result, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ data: null, error: { message } }, { status: 500 });
  }
}
