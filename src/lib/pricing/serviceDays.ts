/**
 * Service-day counting utilities for multi-day subscription pricing (Task 11A).
 *
 * The subscription price must be charged for EVERY service day in the billing
 * period, not just one day. These pure functions are kept I/O-free so they can
 * be used in both server routes and client-side preview without mocking.
 *
 * Terminology:
 *   weekdays       — array of day-of-week integers (0=Sun … 6=Sat) the rider travels
 *   excludedDates  — specific dates (YYYY-MM-DD strings) that are never service days
 *                    (public holidays, school holidays, etc.)
 *   service day    — a calendar day that falls on a selected weekday AND is not excluded
 */

// ── billingCycle → duration mapping ──────────────────────────────────────────

/**
 * Duration (in days) for each billing cycle label stored in SubscriptionPackage.
 * The mapping is intentionally generous — "monthly" means exactly 30 days of
 * service window so that pricing is deterministic before startsOn is set.
 *
 * Add or adjust entries here if new billingCycle values are introduced.
 */
const BILLING_CYCLE_DAYS: Record<string, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  'semi-annual': 180,
  semiannual: 180,
  annual: 365,
  yearly: 365,
};

/**
 * Infer the subscription end date from a start date and billing cycle string.
 *
 * @param startDate   - The first day of the subscription (Date or ISO string).
 * @param billingCycle - The billing cycle label (e.g. "monthly", "quarterly").
 * @returns            End date (last day, inclusive) as a Date.
 *
 * Falls back to 30-day monthly if the billing cycle is unrecognised.
 */
export function inferEndDateFromPackage(
  startDate: Date | string,
  billingCycle: string,
): Date {
  const start = typeof startDate === 'string' ? new Date(startDate) : new Date(startDate);
  const days = BILLING_CYCLE_DAYS[billingCycle.toLowerCase().trim()] ?? 30;
  const end = new Date(start);
  // Add (days - 1) so a 30-day cycle starting on the 1st ends on the 30th.
  end.setDate(start.getDate() + days - 1);
  return end;
}

// ── Core service-day counter ──────────────────────────────────────────────────

/**
 * Count the number of service days between two dates (inclusive on both ends).
 *
 * A "service day" is any calendar day that:
 *   1. Falls on one of the selected `weekdays` (0=Sun … 6=Sat).
 *   2. Is NOT in the `excludedDates` set.
 *
 * @param startDate     - First day of the service window (Date or YYYY-MM-DD string).
 * @param endDate       - Last day of the service window (Date or YYYY-MM-DD string).
 * @param weekdays      - Array of day-of-week integers (0–6) the rider travels.
 *                        Defaults to Mon–Fri ([1,2,3,4,5]) if omitted or empty.
 * @param excludedDates - Optional list of YYYY-MM-DD date strings to skip.
 * @returns               Number of service days ≥ 0.
 */
export function countServiceDays(
  startDate: Date | string,
  endDate: Date | string,
  weekdays: number[] = [1, 2, 3, 4, 5],
  excludedDates: string[] = [],
): number {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);

  if (start > end) return 0;

  const effectiveWeekdays = weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5];
  const weekdaySet = new Set(effectiveWeekdays);
  const excludedSet = new Set(excludedDates.map(normalizeDate));

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    if (weekdaySet.has(cursor.getDay()) && !excludedSet.has(toIsoDate(cursor))) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

// ── Quote-level helper ────────────────────────────────────────────────────────

export type ServiceDayBreakdown = {
  /** Inferred start date (today if not provided). */
  serviceStartDate: string; // YYYY-MM-DD
  /** Inferred end date from billingCycle. */
  serviceEndDate: string; // YYYY-MM-DD
  /** Number of actual service days in the window. */
  actualServiceDays: number;
};

/**
 * Produce the service-day breakdown used by the quote API.
 *
 * @param startsOn      - Desired start date (YYYY-MM-DD). Falls back to today.
 * @param billingCycle  - Package billing cycle string (e.g. "monthly").
 * @param weekdays      - Selected service weekdays (0–6).
 * @param excludedDates - Dates to skip (YYYY-MM-DD).
 */
export function computeServiceDayBreakdown(
  startsOn: string | undefined,
  billingCycle: string,
  weekdays: number[],
  excludedDates: string[] = [],
): ServiceDayBreakdown {
  const start = startsOn ? new Date(startsOn) : new Date();
  const end = inferEndDateFromPackage(start, billingCycle);

  const serviceStartDate = toIsoDate(start);
  const serviceEndDate = toIsoDate(end);
  const actualServiceDays = countServiceDays(start, end, weekdays, excludedDates);

  return { serviceStartDate, serviceEndDate, actualServiceDays };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Parse a date-like value into a UTC-midnight Date (avoids timezone shifts). */
function toDateOnly(d: Date | string): Date {
  if (typeof d === 'string') {
    // Accept YYYY-MM-DD or ISO datetime — take only the date part.
    const [datePart] = d.split('T');
    const [y, m, day] = datePart.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day));
  }
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Format a Date as YYYY-MM-DD. */
function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Normalise a date string to YYYY-MM-DD (strip time portion if present). */
function normalizeDate(s: string): string {
  return s.split('T')[0];
}
