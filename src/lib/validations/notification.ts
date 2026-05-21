import { z } from 'zod';

export const NOTIFICATION_TYPES = [
  'SUBSCRIPTION',
  'SUBSCRIPTION_PAYMENT',
  'SUBSCRIPTION_CANCELLED',
  'PAYMENT',
  'WALLET_TOP_UP',
  'TRIP',
  'DRIVER_APPLICATION',
  'SAFETY',
  'WALLET',
  'SYSTEM',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  unreadOnly: z.coerce.boolean().default(false),
  type: z.string().optional(),
});
