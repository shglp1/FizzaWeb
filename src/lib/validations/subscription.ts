import { z } from 'zod';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const TIME_REGEX = /^\d{2}:\d{2}$/;

// ─── Shared location schema ───────────────────────────────────────────────────

/**
 * Location object produced by the LocationPicker component.
 * Requires both a human-readable label and precise coordinates.
 * This prevents raw free-text from reaching the distance calculation engine.
 */
export const locationInputSchema = z.object({
  label: z.string().min(3, 'Location label must be at least 3 characters').max(500),
  latitude: z
    .number({ required_error: 'Latitude is required' })
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number({ required_error: 'Longitude is required' })
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
});

export type LocationInput = z.infer<typeof locationInputSchema>;

/**
 * Union field that accepts either a coordinate-object (new LocationPicker flow)
 * or a plain string (legacy backward-compat). The API normalises whichever
 * form it receives before calling the routing engine.
 */
const locationField = z.union([
  z.string().min(3, 'Location must be at least 3 characters').max(500),
  locationInputSchema,
]);

// ─── Subscription schemas ─────────────────────────────────────────────────────

export const subscriptionCreateSchema = z.object({
  packageId: z.string().uuid().optional(),
  riderId: z.string().uuid().optional(),
  riderIds: z.array(z.string().uuid()).min(1, 'At least one rider is required').max(10).optional(),
  subscriptionType: z.enum(['school', 'university'], {
    required_error: 'Subscription type is required',
  }),
  /** Accepts { label, latitude, longitude } from LocationPicker, or a plain string (legacy). */
  pickupLocation: locationField,
  /** Accepts { label, latitude, longitude } from LocationPicker, or a plain string (legacy). */
  dropoffLocation: locationField,
  tripDirection: z.enum(['ONE_WAY', 'ROUND_TRIP']).default('ROUND_TRIP'),
  pickupTime: z.string().regex(TIME_REGEX, 'Pickup time must be in HH:MM format'),
  returnTime: z.string().regex(TIME_REGEX, 'Return time must be in HH:MM format'),
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1, 'Select at least one weekday')
    .refine((days) => new Set(days).size === days.length, 'Weekdays must be unique'),
  offDays: z.array(z.number().int().min(0).max(6)).optional().default([]),
  addOnIds: z.array(z.string().uuid()).optional().default([]),
  femaleDriverPreference: z.boolean().optional().default(false),
  autoRenewal: z.boolean().optional().default(true),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  pickupPhotoUrl: z.string().url().optional().nullable(),
  dropoffPhotoUrl: z.string().url().optional().nullable(),
  promoCode: z.string().trim().min(3).max(32).optional(),
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

/**
 * Quote schema — requires coordinate-based location objects.
 * Plain text is not accepted here; users must select via LocationPicker
 * so that distance calculation uses precise coordinates, not geocoded text.
 */
export const subscriptionQuoteSchema = z.object({
  packageId: z.string().uuid().optional(),
  addOnIds: z.array(z.string().uuid()).optional().default([]),
  /** Location with precise coordinates — required for accurate distance calculation. */
  pickupLocation: locationInputSchema,
  /** Location with precise coordinates — required for accurate distance calculation. */
  dropoffLocation: locationInputSchema,
  tripDirection: z.enum(['ONE_WAY', 'ROUND_TRIP']).default('ROUND_TRIP'),
  riderIds: z.array(z.string().uuid()).min(1, 'At least one rider is required').max(10),
  /**
   * Days of week the rider travels (0=Sun … 6=Sat).
   * Defaults to Mon–Fri ([1,2,3,4,5]) when omitted.
   * Used with the package billing cycle to compute actualServiceDays.
   */
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .optional()
    .default([1, 2, 3, 4, 5]),
  /**
   * Desired subscription start date (YYYY-MM-DD).
   * Defaults to today when omitted. Used with billingCycle to determine service window.
   */
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
  promoCode: z.string().trim().min(3).max(32).optional(),
});

export const adminSubscriptionUpdateSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED']).optional(),
  autoRenewal: z.boolean().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const adminSubscriptionCancelSchema = z.object({
  reason: z.string().min(5, 'Cancellation reason must be at least 5 characters').max(1000),
});

export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;
export type SubscriptionQuoteInput = z.infer<typeof subscriptionQuoteSchema>;
export { WEEKDAYS };
