import { z } from 'zod';

/** Uploaded file path (/uploads/…) or absolute http(s) URL. */
export const uploadedOrHttpUrl = z
  .string()
  .min(1)
  .refine((v) => v.startsWith('/uploads/') || /^https?:\/\//i.test(v), {
    message: 'Must be an uploaded file or valid URL',
  });
