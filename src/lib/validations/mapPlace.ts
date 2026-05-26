import { z } from 'zod';

const mapPlaceTypeEnum = z.enum([
  'DISTRICT',
  'SCHOOL',
  'UNIVERSITY',
  'MOSQUE',
  'HOSPITAL',
  'LANDMARK',
  'STREET',
  'BUILDING',
  'GATE',
  'OTHER',
]);

function aliasesField() {
  return z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => {
      if (v == null) return [];
      if (Array.isArray(v)) return v.map((s) => s.trim()).filter(Boolean);
      return v
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    });
}

export const mapPlaceCreateSchema = z.object({
  nameAr: z.string().trim().min(2, 'Arabic name is required').max(200),
  nameEn: z.string().trim().min(2, 'English name is required').max(200),
  type: mapPlaceTypeEnum,
  city: z.string().trim().min(2).max(120),
  region: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(2).optional().default('SA'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  aliasesAr: aliasesField(),
  aliasesEn: aliasesField(),
  isActive: z.boolean().optional().default(true),
  isVerified: z.boolean().optional().default(false),
  notes: z.string().max(2000).optional().nullable(),
});

export const mapPlaceUpdateSchema = mapPlaceCreateSchema.partial();

export type MapPlaceCreateInput = z.infer<typeof mapPlaceCreateSchema>;
export type MapPlaceUpdateInput = z.infer<typeof mapPlaceUpdateSchema>;
