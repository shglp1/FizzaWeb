/**
 * Local file storage for chat image attachments.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const IMAGE_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ALLOWED_MIME: Record<string, string> = {
  ...IMAGE_MIME,
  'application/pdf': '.pdf',
};

export type UploadCategory =
  | 'profile-avatar'
  | 'rider-avatar'
  | 'safety-attachment'
  | 'driver-document';

const CATEGORY_MIMES: Record<UploadCategory, string[]> = {
  'profile-avatar': ['image/jpeg', 'image/png', 'image/webp'],
  'rider-avatar': ['image/jpeg', 'image/png', 'image/webp'],
  'safety-attachment': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'driver-document': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};

export function getMaxUploadBytes(): number {
  const mb = Number(process.env.UPLOAD_MAX_SIZE_MB ?? '5');
  return (Number.isFinite(mb) && mb > 0 ? mb : 5) * 1024 * 1024;
}

export function validateImageUpload(
  mimeType: string,
  sizeBytes: number,
): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = IMAGE_MIME[mimeType];
  if (!ext) {
    return { ok: false, error: 'Only JPEG, PNG, and WebP images are allowed' };
  }
  if (sizeBytes <= 0) {
    return { ok: false, error: 'Empty file' };
  }
  if (sizeBytes > getMaxUploadBytes()) {
    return { ok: false, error: `File exceeds maximum size of ${process.env.UPLOAD_MAX_SIZE_MB ?? '5'} MB` };
  }
  return { ok: true, ext };
}

export function validateCategoryUpload(
  category: UploadCategory,
  mimeType: string,
  sizeBytes: number,
): { ok: true; ext: string } | { ok: false; error: string } {
  const allowed = CATEGORY_MIMES[category] ?? [];
  if (!allowed.includes(mimeType)) {
    return { ok: false, error: 'File type is not allowed for this upload' };
  }
  const ext = ALLOWED_MIME[mimeType];
  if (!ext) return { ok: false, error: 'Unsupported file type' };
  if (sizeBytes <= 0) return { ok: false, error: 'Empty file' };
  if (sizeBytes > getMaxUploadBytes()) {
    return { ok: false, error: `File exceeds maximum size of ${process.env.UPLOAD_MAX_SIZE_MB ?? '5'} MB` };
  }
  return { ok: true, ext };
}

export async function saveUserUpload(
  userId: string,
  category: UploadCategory,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  return saveLocalImage(['users', userId, category], buffer, ext);
}

export async function saveChatImage(
  tripId: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  return saveLocalImage(['chat', tripId], buffer, ext);
}

export async function saveLocationPhoto(
  userId: string,
  kind: 'pickup' | 'dropoff',
  buffer: Buffer,
  ext: string,
): Promise<string> {
  return saveLocalImage(['locations', userId, kind], buffer, ext);
}

async function saveLocalImage(segments: string[], buffer: Buffer, ext: string): Promise<string> {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  if (driver !== 'local') {
    throw new Error('Only local storage is implemented for uploads');
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', ...segments);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, buffer);
  return `/uploads/${segments.join('/')}/${filename}`;
}
