import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { generatePayrollRun, PayrollGenerationError } from '@/lib/payroll/generatePayrollRun';

const generateSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  regenerate: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (year && month) {
      const run = await prisma.payrollRun.findUnique({
        where: {
          year_month: {
            year: parseInt(year, 10),
            month: parseInt(month, 10),
          },
        },
        include: {
          lines: {
            include: {
              driver: {
                include: {
                  profile: { include: { user: { select: { email: true } } } },
                },
              },
              tripEarnings: {
                include: {
                  trip: {
                    select: {
                      id: true,
                      scheduledDate: true,
                      pickupLocation: true,
                      dropoffLocation: true,
                      legType: true,
                    },
                  },
                },
                orderBy: { tripCompletedAt: 'asc' },
              },
            },
            orderBy: { netPaySar: 'desc' },
          },
        },
      });

      if (!run) {
        return NextResponse.json(
          { data: null, error: { message: 'Payroll run not found' } },
          { status: 404 },
        );
      }

      return NextResponse.json({ data: run, error: null });
    }

    const runs = await prisma.payrollRun.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        _count: { select: { lines: true } },
        lines: { select: { status: true, netPaySar: true } },
      },
    });

    const summary = runs.map((r) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      status: r.status,
      generatedAt: r.generatedAt,
      lineCount: r._count.lines,
      totalNetPaySar: r.lines.reduce((s, l) => s + Number(l.netPaySar), 0),
      paidCount: r.lines.filter((l) => l.status === 'PAID').length,
      approvedCount: r.lines.filter((l) => l.status === 'APPROVED').length,
    }));

    return NextResponse.json({ data: summary, error: null });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireRole(['ADMIN']);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid input' } },
        { status: 400 },
      );
    }

    try {
      const run = await generatePayrollRun({
        ...parsed.data,
        generatedById: auth.userId,
      });
      return NextResponse.json({ data: run, error: null }, { status: 201 });
    } catch (err) {
      if (err instanceof PayrollGenerationError) {
        const status = err.code === 'PERIOD_EXISTS' ? 409 : 400;
        return NextResponse.json({ data: null, error: { message: err.message, code: err.code } }, { status });
      }
      throw err;
    }
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
