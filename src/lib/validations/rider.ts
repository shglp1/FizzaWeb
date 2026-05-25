import { z } from 'zod';
import { uploadedOrHttpUrl } from './upload.ts';

const optionalText = z.string().max(2000).optional().nullable();
const optionalShort = z.string().max(200).optional().nullable();

export const riderCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  relationship: z.string().min(1, 'Relationship is required').max(80),
  school: optionalShort,
  grade: optionalShort,
  phone: optionalShort,
  dateOfBirth: z.string().optional().nullable(),
  gender: optionalShort,
  specialNeeds: z.boolean().optional().default(false),
  specialNeedsNotes: optionalText,
  medicalNotes: optionalText,
  allergies: optionalText,
  pickupNotes: optionalText,
  dropoffNotes: optionalText,
  emergencyContactName: optionalShort,
  emergencyContactPhone: optionalShort,
  authorizedPickupPersons: optionalText,
  preferredLanguage: z.enum(['ar', 'en']).optional().nullable(),
  avatarUrl: uploadedOrHttpUrl.optional().nullable().or(z.literal('')),
  notes: optionalText,
});

export const riderUpdateSchema = z.object({
  id: z.string().min(1, 'Rider ID is required'),
  name: z.string().min(1, 'Name is required').max(120).optional(),
  relationship: z.string().min(1).max(80).optional(),
  school: optionalShort,
  grade: optionalShort,
  phone: optionalShort,
  dateOfBirth: z.string().optional().nullable(),
  gender: optionalShort,
  specialNeeds: z.boolean().optional(),
  specialNeedsNotes: optionalText,
  medicalNotes: optionalText,
  allergies: optionalText,
  pickupNotes: optionalText,
  dropoffNotes: optionalText,
  emergencyContactName: optionalShort,
  emergencyContactPhone: optionalShort,
  authorizedPickupPersons: optionalText,
  preferredLanguage: z.enum(['ar', 'en']).optional().nullable(),
  avatarUrl: uploadedOrHttpUrl.optional().nullable().or(z.literal('')),
  notes: optionalText,
  isActive: z.boolean().optional(),
});
