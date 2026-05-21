import { z } from 'zod';

export const MIN_TOP_UP_SAR = 10;
export const MAX_TOP_UP_SAR = 10_000;

export const createPaymentSchema = z
  .object({
    purpose: z.enum(['WALLET_TOP_UP', 'SUBSCRIPTION_PAYMENT']),
    amountSar: z
      .number()
      .positive()
      .min(MIN_TOP_UP_SAR)
      .max(MAX_TOP_UP_SAR)
      .optional(),
    subscriptionId: z.string().uuid().optional(),
  })
  .refine(
    (d) => d.purpose !== 'WALLET_TOP_UP' || d.amountSar !== undefined,
    {
      message: `amountSar is required for top-up (min ${MIN_TOP_UP_SAR} SAR)`,
      path: ['amountSar'],
    },
  )
  .refine(
    (d) => d.purpose !== 'SUBSCRIPTION_PAYMENT' || d.subscriptionId !== undefined,
    {
      message: 'subscriptionId is required for subscription payment',
      path: ['subscriptionId'],
    },
  );

export const webhookPayloadSchema = z
  .object({
    PaymentId: z.union([z.string(), z.number()]).transform(String),
  })
  .passthrough();
