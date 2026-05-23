/**
 * Driver schedule conflict detection utilities (Task 11F).
 *
 * A "conflict" occurs when a driver is already assigned to another active
 * subscription that runs on the same weekday(s) as the proposed assignment.
 *
 * These are pure functions that operate on pre-fetched data to keep them
 * testable without database access.
 */

export type WeekdaySchedule = {
  weekday: number; // 0=Sun … 6=Sat
  isOffDay: boolean;
};

export type DriverAssignmentInfo = {
  subscriptionId: string;
  schedule: WeekdaySchedule[];
};

/**
 * Extract the set of active service weekdays from a schedule list.
 * Off-days are excluded — they are days that fall within the schedule
 * but the rider doesn't travel (e.g. public holidays).
 */
export function getActiveWeekdays(schedule: WeekdaySchedule[]): Set<number> {
  return new Set(schedule.filter((s) => !s.isOffDay).map((s) => s.weekday));
}

/**
 * Check whether two weekday sets share any common day.
 */
export function weekdaysOverlap(a: Set<number>, b: Set<number>): boolean {
  for (const day of a) {
    if (b.has(day)) return true;
  }
  return false;
}

/**
 * Find conflicts for a proposed driver assignment.
 *
 * @param proposedWeekdays   - Active weekdays of the subscription being assigned.
 * @param existingAssignments - Other active assignments already held by the driver.
 * @returns Array of conflicting subscription IDs (empty = no conflicts).
 */
export function findConflicts(
  proposedWeekdays: Set<number> | number[],
  existingAssignments: DriverAssignmentInfo[],
): string[] {
  const proposed =
    proposedWeekdays instanceof Set
      ? proposedWeekdays
      : new Set(proposedWeekdays);

  const conflicts: string[] = [];

  for (const assignment of existingAssignments) {
    const existing = getActiveWeekdays(assignment.schedule);
    if (weekdaysOverlap(proposed, existing)) {
      conflicts.push(assignment.subscriptionId);
    }
  }

  return conflicts;
}

/**
 * Determine whether a proposed assignment has any conflicts.
 * Convenience wrapper around `findConflicts`.
 */
export function hasConflict(
  proposedWeekdays: Set<number> | number[],
  existingAssignments: DriverAssignmentInfo[],
): boolean {
  return findConflicts(proposedWeekdays, existingAssignments).length > 0;
}
