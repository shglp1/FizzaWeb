import { NextResponse } from 'next/server';
import { z } from 'zod';

const resetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = resetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: { message: 'Invalid request' } },
        { status: 400 },
      );
    }

    // Always return the same generic response regardless of whether the email exists.
    // This prevents email enumeration via the reset-password endpoint.
    // TODO: implement actual email dispatch (SMTP / SendGrid) when email service is configured.
    return NextResponse.json({
      data: { message: 'If that email is registered, a reset link has been sent.' },
      error: null,
    });
  } catch {
    return NextResponse.json(
      { data: null, error: { message: 'Internal Server Error' } },
      { status: 500 },
    );
  }
}
