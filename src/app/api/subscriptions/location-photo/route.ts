import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { saveLocationPhoto, validateImageUpload } from '@/lib/storage/localUpload';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const form = await req.formData();
    const file = form.get('file');
    const kind = form.get('kind');
    if (!(file instanceof File)) {
      return NextResponse.json({ data: null, error: { message: 'File is required' } }, { status: 400 });
    }
    if (kind !== 'pickup' && kind !== 'dropoff') {
      return NextResponse.json({ data: null, error: { message: 'Invalid kind' } }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = validateImageUpload(file.type, buffer.length);
    if (!validated.ok) {
      return NextResponse.json({ data: null, error: { message: validated.error } }, { status: 400 });
    }

    const url = await saveLocationPhoto(auth.userId, kind, buffer, validated.ext);
    return NextResponse.json({ data: { url }, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: { message: 'Upload failed' } }, { status: 500 });
  }
}
