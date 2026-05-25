import { z } from 'zod';
import { uploadedOrHttpUrl } from '@/lib/validations/upload';

export const SAFETY_CATEGORIES = [
  'UNSAFE_DRIVING',
  'HARASSMENT',
  'VEHICLE_CONDITION',
  'ROUTE_DEVIATION',
  'LATE_PICKUP',
  'BEHAVIOUR',
  'OTHER',
] as const;

export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

export const safetyReportCreateSchema = z.object({
  category: z.enum(SAFETY_CATEGORIES),
  description: z.string().min(20, 'Description must be at least 20 characters').max(5000),
  tripId: z.string().uuid().optional(),
  attachmentUrls: z.array(uploadedOrHttpUrl).max(10).optional(),
});

export const safetyReportUpdateSchema = z.object({
  description: z.string().min(20).max(5000).optional(),
  attachmentUrls: z.array(uploadedOrHttpUrl).max(10).optional(),
});

export const adminSafetyReviewSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'RESOLVE']),
    adminResponse: z.string().min(1).max(2000).optional(),
  })
  .refine(
    (d) => {
      if (d.action === 'REJECT' || d.action === 'RESOLVE') {
        return !!d.adminResponse && d.adminResponse.trim().length > 0;
      }
      return true;
    },
    { message: 'adminResponse is required for REJECT and RESOLVE actions', path: ['adminResponse'] },
  );

export const SAFETY_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type SafetySeverityFilter = (typeof SAFETY_SEVERITIES)[number];

export const safetyListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED']).optional(),
  category: z.enum(SAFETY_CATEGORIES).optional(),
  severity: z.enum(SAFETY_SEVERITIES).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
