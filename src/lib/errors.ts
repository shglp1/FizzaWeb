/**
 * Error helpers for safe client-facing error responses.
 *
 * Internal/Prisma/runtime error messages can leak schema details, file paths,
 * or other implementation specifics. Routes should log the full error
 * server-side and only return a sanitized message to clients. Use
 * `BusinessError` for messages that are intentionally safe to show to users.
 */

/**
 * An error whose message is deliberately written to be shown to end users
 * (e.g. validation/eligibility rules). Distinguishes intended user-facing
 * messages from internal errors that must not be exposed.
 */
export class BusinessError extends Error {
  /** Optional HTTP status hint for the route layer. */
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'BusinessError';
    this.status = status;
  }
}

/**
 * Returns a client-safe message for an error: the original message only when it
 * is a `BusinessError`, otherwise the provided generic fallback. Always log the
 * raw error server-side before calling this.
 */
export function clientErrorMessage(err: unknown, fallback = 'Internal server error'): string {
  if (err instanceof BusinessError) return err.message;
  return fallback;
}
