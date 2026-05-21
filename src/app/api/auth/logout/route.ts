import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('fizza-session');
    cookieStore.delete('fizza-role');

    return NextResponse.json({ data: true, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: { message: error.message || 'Internal Server Error' } }, { status: 500 });
  }
}
