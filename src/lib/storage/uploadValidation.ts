/** Upload validation and category metadata — shared by local and R2 drivers. */

export type UploadCategory =
  | 'profile-avatar'
  | 'rider-avatar'
  | 'safety-attachment'
  | 'driver-document'
  | 'driver-vehicle-photo';

const IMAGE_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ALLOWED_MIME: Record<string, string> = {
  ...IMAGE_MIME,
  'application/pdf': '.pdf',
};

const CATEGORY_MIMES: Record<UploadCategory, string[]> = {
  'profile-avatar': ['image/jpeg', 'image/png', 'image/webp'],
  'rider-avatar': ['image/jpeg', 'image/png', 'image/webp'],
  'safety-attachment': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'driver-document': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'driver-vehicle-photo': ['image/jpeg', 'image/png', 'image/webp'],
};

/** Folder names under the storage root (no path traversal). */
export const CATEGORY_FOLDER: Record<UploadCategory, string> = {
  'profile-avatar': 'avatars',
  'rider-avatar': 'riders',
  'safety-attachment': 'safety',
  'driver-document': 'driver-documents',
  'driver-vehicle-photo': 'driver-documents',
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

export type StorageDriver = 'local' | 'r2';

export function getStorageDriver(): StorageDriver {
  const d = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  return d === 'r2' ? 'r2' : 'local';
}

export function validateR2Config(): { ok: true } | { ok: false; message: string } {
  const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'] as const;
  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    return { ok: false, message: 'Production file storage is not configured.' };
  }
  return { ok: true };
}

export { IMAGE_MIME, ALLOWED_MIME };
