/**
 * Payment gateway types — no 'server-only' import so these can be
 * imported in Node.js smoke tests and shared utility functions.
 */

// ─── Error reason codes ───────────────────────────────────────────────────────

export type PaymentGatewayReason =
  | 'NOT_CONFIGURED'
  | 'INVALID_PARAMS'
  | 'PAYMENT_GATEWAY_REJECTED'
  | 'PAYMENT_GATEWAY_HTTP_ERROR'
  | 'PAYMENT_GATEWAY_NETWORK_ERROR'
  | 'PAYMENT_GATEWAY_INVALID_RESPONSE';

// ─── Structured error class ───────────────────────────────────────────────────

/**
 * Thrown by createInvoice() (and other gateway calls) instead of plain Error.
 * Carries a machine-readable `reason` code, the HTTP status from the provider
 * (when available), and the provider's own error message for logging.
 *
 * Intentionally does NOT import 'server-only' so tests can import it directly.
 */
export class PaymentGatewayError extends Error {
  readonly reason: PaymentGatewayReason;
  readonly providerStatus?: number;
  readonly providerMessage?: string;

  constructor(
    message: string,
    reason: PaymentGatewayReason,
    options?: { providerStatus?: number; providerMessage?: string },
  ) {
    super(message);
    this.name = 'PaymentGatewayError';
    this.reason = reason;
    this.providerStatus = options?.providerStatus;
    this.providerMessage = options?.providerMessage;
    // Restore prototype chain (required when extending built-ins in TS)
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Pure helpers used by both route and tests ────────────────────────────────

/**
 * Map a caught invoice-creation error to a safe client-facing error payload.
 * Never includes internal error messages or stack traces.
 */
export function mapGatewayErrorToResponse(err: unknown): {
  message: string;
  reason: PaymentGatewayReason | 'UNKNOWN';
  providerStatus?: number;
} {
  if (err instanceof PaymentGatewayError) {
    return {
      message: 'Failed to create payment invoice.',
      reason: err.reason,
      ...(err.providerStatus !== undefined ? { providerStatus: err.providerStatus } : {}),
    };
  }
  return {
    message: 'Failed to create payment invoice.',
    reason: 'UNKNOWN' as const,
  };
}

/**
 * Build a safe server-side log payload for invoice failures.
 * NEVER includes apiKey, Authorization header, or raw credentials.
 */
export function buildSafeLogPayload(
  params: { userId: string; purpose: string; amountSar: number; paymentId: string },
  err: unknown,
): Record<string, unknown> {
  return {
    userId: params.userId,
    purpose: params.purpose,
    amountSar: params.amountSar,
    paymentId: params.paymentId,
    reason: err instanceof PaymentGatewayError ? err.reason : 'UNKNOWN',
    providerStatus: err instanceof PaymentGatewayError ? err.providerStatus : undefined,
    providerMessage: err instanceof PaymentGatewayError ? err.providerMessage : undefined,
    error: err instanceof Error ? err.message : 'Invoice creation failed',
    // NOTE: MYFATOORAH_API_KEY and Authorization header are intentionally excluded
  };
}
