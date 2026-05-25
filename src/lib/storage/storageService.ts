import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  CATEGORY_FOLDER,
  type UploadCategory,
  validateCategoryUpload,
  validateImageUpload,
  getStorageDriver,
  validateR2Config,
  type StorageDriver,
} from './uploadValidation';

export type { StorageDriver };
export { getStorageDriver, validateR2Config };

export type UploadResult = { url: string; key: string };

function buildObjectKey(category: UploadCategory, userId: string, ext: string, subPath?: string): string {
  const folder = CATEGORY_FOLDER[category];
  const safeUser = userId.replace(/[^a-zA-Z0-9-]/g, '');
  const segments = [folder, safeUser];
  if (subPath) segments.push(subPath.replace(/[^a-zA-Z0-9-]/g, ''));
  segments.push(`${randomUUID()}${ext}`);
  return segments.join('/');
}

async function uploadLocal(key: string, buffer: Buffer): Promise<string> {
  const fullPath = path.join(process.cwd(), 'public', 'uploads', ...key.split('/'));
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return `/uploads/${key}`;
}

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID!.trim();
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

async function uploadR2(key: string, buffer: Buffer, mimeType: string): Promise<string> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET!.trim();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  );
  const base = process.env.R2_PUBLIC_BASE_URL!.trim().replace(/\/$/, '');
  return `${base}/${key}`;
}

export async function uploadFile(opts: {
  category: UploadCategory;
  userId: string;
  buffer: Buffer;
  ext: string;
  mimeType: string;
  subPath?: string;
}): Promise<UploadResult> {
  const driver = getStorageDriver();
  if (driver === 'r2') {
    const cfg = validateR2Config();
    if (!cfg.ok) throw new StorageNotConfiguredError(cfg.message);
  }

  const key = buildObjectKey(opts.category, opts.userId, opts.ext, opts.subPath);
  const url =
    driver === 'r2'
      ? await uploadR2(key, opts.buffer, opts.mimeType)
      : await uploadLocal(key, opts.buffer);

  return { url, key };
}

export class StorageNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageNotConfiguredError';
  }
}

export async function saveUserUpload(
  userId: string,
  category: UploadCategory,
  buffer: Buffer,
  ext: string,
  mimeType = 'application/octet-stream',
): Promise<string> {
  const result = await uploadFile({ category, userId, buffer, ext, mimeType });
  return result.url;
}

export async function saveChatImage(tripId: string, buffer: Buffer, ext: string, mimeType: string): Promise<string> {
  const driver = getStorageDriver();
  if (driver === 'r2') {
    const cfg = validateR2Config();
    if (!cfg.ok) throw new StorageNotConfiguredError(cfg.message);
  }
  const key = `chat/${tripId.replace(/[^a-zA-Z0-9-]/g, '')}/${randomUUID()}${ext}`;
  const url =
    driver === 'r2'
      ? await uploadR2(key, buffer, mimeType)
      : await uploadLocal(key, buffer);
  return url;
}

export async function saveLocationPhoto(
  userId: string,
  kind: 'pickup' | 'dropoff',
  buffer: Buffer,
  ext: string,
  mimeType: string,
): Promise<string> {
  const driver = getStorageDriver();
  if (driver === 'r2') {
    const cfg = validateR2Config();
    if (!cfg.ok) throw new StorageNotConfiguredError(cfg.message);
  }
  const safeUser = userId.replace(/[^a-zA-Z0-9-]/g, '');
  const key = `subscription-locations/${safeUser}/${kind}/${randomUUID()}${ext}`;
  const url =
    driver === 'r2'
      ? await uploadR2(key, buffer, mimeType)
      : await uploadLocal(key, buffer);
  return url;
}

export { validateCategoryUpload, validateImageUpload, type UploadCategory };
