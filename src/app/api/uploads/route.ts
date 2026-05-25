import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import {
  saveUserUpload,
  validateCategoryUpload,
  StorageNotConfiguredError,
  type UploadCategory,
} from '@/lib/storage/storageService';

const ALLOWED: UploadCategory[] = [
  'profile-avatar',
  'rider-avatar',
  'safety-attachment',
  'driver-document',
  'driver-vehicle-photo',
];

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const form = await req.formData();
    const file = form.get('file');
    const category = String(form.get('category') ?? '') as UploadCategory;

    if (!ALLOWED.includes(category)) {
      return NextResponse.json({ data: null, error: { message: 'Invalid upload category' } }, { status: 400 });
    }

    if (!(file instanceof Blob)) {
      return NextResponse.json({ data: null, error: { message: 'file field required' } }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'application/octet-stream';
    const validation = validateCategoryUpload(category, mimeType, buffer.length);
    if (!validation.ok) {
      return NextResponse.json({ data: null, error: { message: validation.error } }, { status: 400 });
    }

    const url = await saveUserUpload(auth.userId, category, buffer, validation.ext, mimeType);
    return NextResponse.json({ data: { url }, error: null }, { status: 201 });
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      return NextResponse.json({ data: null, error: { message: e.message } }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : 'Internal Server Error';
    return NextResponse.json({ data: null, error: { message } }, { status: 500 });
  }
}
