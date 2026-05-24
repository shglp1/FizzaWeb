/** Returns whether a request would pass cron secret verification (for tests + routes). */
export function isAuthorizedCronRequest(
  authHeader: string | null,
  cronSecret: string | null | undefined,
): boolean {
  const secret = cronSecret?.trim();
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
