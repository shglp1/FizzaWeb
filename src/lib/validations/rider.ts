import { z } from 'zod';

export const riderCreateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  relationship: z.string().min(1, 'Relationship is required'),
  school: z.string().optional(),
  grade: z.string().optional(),
  phone: z.string().optional(),
  specialNeeds: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export const riderUpdateSchema = z.object({
  id: z.string().min(1, 'Rider ID is required'),
  name: z.string().min(1, 'Name is required').optional(),
  relationship: z.string().optional(),
  school: z.string().optional(),
  grade: z.string().optional(),
  phone: z.string().optional(),
  specialNeeds: z.boolean().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});
