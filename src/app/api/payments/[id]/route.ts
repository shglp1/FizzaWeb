import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/session';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const userId = auth.userId;
    const { id } = await context.params;

    const payment = await prisma.payment.findFirst({
      where: { id, userId },
      select: {
        id: true,
        amountSar: true,
        status: true,
        purpose: true,
        gateway: true,
        invoiceId: true,
        subscriptionId: true,
        createdAt: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { data: null, error: { message: 'Payment not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: { payment }, error: null });
  } catch (error) {
    console.error('[GET /api/payments/[id]]', error);
    return NextResponse.json(
      { data: null, error: { message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
