import { z } from 'zod';
import { uploadedOrHttpUrl } from './upload.ts';

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
  phone: z.string().min(9, 'Phone must be at least 9 characters').optional(),
  avatarUrl: uploadedOrHttpUrl.optional().or(z.literal('')),
});
