import { z } from 'zod';

export const promoCodeCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Code must be at least 3 characters')
    .max(32)
    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dash or underscore only'),
  partnerName: z.string().trim().max(120).optional().nullable(),
  discountPercent: z.number().int().min(1).max(100),
  maxUses: z.number().int().min(1).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const promoCodeUpdateSchema = promoCodeCreateSchema.partial();

export type PromoCodeCreateInput = z.infer<typeof promoCodeCreateSchema>;
