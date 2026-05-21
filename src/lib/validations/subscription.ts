import { z } from 'zod';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const TIME_REGEX = /^\d{2}:\d{2}$/;

export const subscriptionCreateSchema = z.object({
  packageId: z.string().uuid().optional(),
  riderId: z.string().uuid().optional(),
  subscriptionType: z.enum(['school', 'university'], {
    required_error: 'Subscription type is required',
  }),
  pickupLocation: z.string().min(3, 'Pickup location must be at least 3 characters'),
  dropoffLocation: z.string().min(3, 'Dropoff location must be at least 3 characters'),
  pickupTime: z
    .string()
    .regex(TIME_REGEX, 'Pickup time must be in HH:MM format'),
  returnTime: z
    .string()
    .regex(TIME_REGEX, 'Return time must be in HH:MM format'),
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Select at least one weekday')
    .refine((days) => new Set(days).size === days.length, 'Weekdays must be unique'),
  offDays: z.array(z.number().int().min(0).max(6)).optional().default([]),
  addOnIds: z.array(z.string().uuid()).optional().default([]),
  femaleDriverPreference: z.boolean().optional().default(false),
  autoRenewal: z.boolean().optional().default(true),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
});

export const subscriptionUpdateSchema = z.object({
  pickupLocation: z.string().min(3).optional(),
  dropoffLocation: z.string().min(3).optional(),
  pickupTime: z.string().regex(TIME_REGEX).optional(),
  returnTime: z.string().regex(TIME_REGEX).optional(),
  femaleDriverPreference: z.boolean().optional(),
  autoRenewal: z.boolean().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;
export { WEEKDAYS };
