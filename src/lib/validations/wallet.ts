import { z } from 'zod';

export const paySubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
});

export const quickTopUpAmounts = [50, 100, 200, 500] as const;
