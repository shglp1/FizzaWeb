/**
 * Local file storage for chat image attachments.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function getMaxUploadBytes(): number {
  const mb = Number(process.env.UPLOAD_MAX_SIZE_MB ?? '5');
  return (Number.isFinite(mb) && mb > 0 ? mb : 5) * 1024 * 1024;
}

export function validateImageUpload(
  mimeType: string,
  sizeBytes: number,
): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = ALLOWED_MIME[mimeType];
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

export async function saveChatImage(
  tripId: string,
  buffer: Buffer,
  ext: string,
): Promise<string> {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  if (driver !== 'local') {
    throw new Error('Only local storage is implemented for chat attachments');
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'chat', tripId);
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}${ext}`;
  const fullPath = path.join(dir, filename);
  await writeFile(fullPath, buffer);
  return `/uploads/chat/${tripId}/${filename}`;
}
