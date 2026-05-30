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

/**
 * Detects a file's true type from its leading bytes (magic numbers), independent
 * of the client-supplied MIME type. Returns the canonical MIME string, or null
 * if the signature is not one of our supported types.
 */
export function detectFileSignature(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  // PDF: "%PDF-"
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    return 'application/pdf';
  }
  return null;
}

/**
 * Verifies the file's real signature matches the declared MIME type. Prevents
 * disguised content (e.g. an executable/HTML uploaded as `image/png`) from being
 * stored and later served. Only enforces for types we can fingerprint.
 */
export function verifyFileSignature(
  declaredMime: string,
  buffer: Buffer,
): { ok: true } | { ok: false; error: string } {
  const detected = detectFileSignature(buffer);
  if (detected === null) {
    return { ok: false, error: 'File content does not match an allowed file type' };
  }
  if (detected !== declaredMime) {
    return { ok: false, error: 'File content does not match its declared type' };
  }
  return { ok: true };
}

/**
 * Validates that an attachment URL points only to our own storage:
 *  - a same-origin local upload path (`/uploads/...`), or
 *  - the configured R2 public base URL.
 *
 * Prevents users from injecting arbitrary external URLs (tracking pixels,
 * malicious content, SSRF-adjacent references) into chat/report attachments.
 */
export function isAllowedAttachmentUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;

  // Same-origin local upload path. Reject protocol-relative (`//host`) and traversal.
  if (url.startsWith('/uploads/') && !url.startsWith('//') && !url.includes('..')) {
    return true;
  }

  const base = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (base) {
    try {
      const baseUrl = new URL(base);
      const target = new URL(url);
      if (
        target.protocol === baseUrl.protocol &&
        target.host === baseUrl.host &&
        target.pathname.startsWith(baseUrl.pathname === '/' ? '/' : `${baseUrl.pathname}/`)
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

export { IMAGE_MIME, ALLOWED_MIME };
