import 'server-only';
import { generateTrips } from './generateTrips';

/** Generate initial trips when a subscription is activated by payment. */
export async function triggerTripGenerationAfterPayment(subscriptionId: string): Promise<void> {
  try {
    await generateTrips({
      subscriptionId,
      triggeredBy: 'PAYMENT',
      actorUserId: null,
    });
  } catch (err) {
    console.error('[dispatch] post-payment generation failed', subscriptionId, err);
  }
}
