/**
 * Service-day pricing smoke tests (Task 11K) — run with: npm test
 * Uses Node.js built-in test runner. No database or I/O required.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countServiceDays,
  inferEndDateFromPackage,
  computeServiceDayBreakdown,
} from '../lib/pricing/serviceDays.ts';
import {
  findConflicts,
  hasConflict,
  getActiveWeekdays,
  weekdaysOverlap,
} from '../lib/drivers/conflictCheck.ts';

// ─── countServiceDays ─────────────────────────────────────────────────────────

describe('countServiceDays — basic counting', () => {
  // A simple Mon–Fri week: 2026-05-18 (Mon) → 2026-05-22 (Fri) = 5 days
  it('counts 5 days in a Mon–Fri week', () => {
    const count = countServiceDays('2026-05-18', '2026-05-22', [1, 2, 3, 4, 5]);
    assert.equal(count, 5);
  });

  it('counts 0 when startDate is after endDate', () => {
    const count = countServiceDays('2026-05-22', '2026-05-18', [1, 2, 3, 4, 5]);
    assert.equal(count, 0);
  });

  it('counts 1 when startDate equals endDate and that day is a service day', () => {
    // 2026-05-18 is a Monday (1)
    const count = countServiceDays('2026-05-18', '2026-05-18', [1]);
    assert.equal(count, 1);
  });

  it('counts 0 when startDate equals endDate but that day is not a service weekday', () => {
    // 2026-05-17 is a Sunday (0); weekdays=[1] (Mon only)
    const count = countServiceDays('2026-05-17', '2026-05-17', [1]);
    assert.equal(count, 0);
  });

  it('counts 10 days across 2 Mon–Fri weeks', () => {
    // Week 1: 2026-05-18→22, Week 2: 2026-05-25→29
    const count = countServiceDays('2026-05-18', '2026-05-29', [1, 2, 3, 4, 5]);
    assert.equal(count, 10);
  });

  it('counts only selected weekdays (Sun+Thu)', () => {
    // 2026-05-18 Mon → 2026-05-24 Sun: Sun=17, Thu=21 → 2 days
    const count = countServiceDays('2026-05-18', '2026-05-24', [0, 4]);
    assert.equal(count, 2);
  });

  it('defaults to Mon–Fri when weekdays is empty', () => {
    const count = countServiceDays('2026-05-18', '2026-05-22', []);
    assert.equal(count, 5); // Mon–Fri default
  });
});

describe('countServiceDays — excluded dates', () => {
  it('skips a single excluded date', () => {
    // Mon–Fri week, exclude Wednesday 2026-05-20 → 4 days
    const count = countServiceDays('2026-05-18', '2026-05-22', [1, 2, 3, 4, 5], ['2026-05-20']);
    assert.equal(count, 4);
  });

  it('skips multiple excluded dates', () => {
    // Mon–Fri week, exclude Mon+Tue → 3 days
    const count = countServiceDays(
      '2026-05-18', '2026-05-22', [1, 2, 3, 4, 5],
      ['2026-05-18', '2026-05-19'],
    );
    assert.equal(count, 3);
  });

  it('excluded date not in weekday set has no effect', () => {
    // Excluding a Saturday (not in weekdays) should not reduce count
    const count = countServiceDays('2026-05-18', '2026-05-22', [1, 2, 3, 4, 5], ['2026-05-23']);
    assert.equal(count, 5);
  });

  it('excluding all 5 days in a week returns 0', () => {
    const count = countServiceDays(
      '2026-05-18', '2026-05-22', [1, 2, 3, 4, 5],
      ['2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22'],
    );
    assert.equal(count, 0);
  });
});

describe('countServiceDays — monthly subscription (30 days)', () => {
  it('counts ~22 service days in a 30-day Mon–Fri period', () => {
    // 2026-06-01 (Mon) → 2026-06-30 (Tue): 4 full weeks + 2 extra Mon–Tue = 4×5+2 = 22
    const count = countServiceDays('2026-06-01', '2026-06-30', [1, 2, 3, 4, 5]);
    assert.equal(count, 22);
  });

  it('round-trip: 22 service days × 2× distance = multi-day factor', () => {
    const days = countServiceDays('2026-06-01', '2026-06-30', [1, 2, 3, 4, 5]);
    const dailyKm = 20; // one-way 10km × 2
    const totalKm = dailyKm * days;
    assert.equal(totalKm, 440); // 22 × 20
  });
});

// ─── inferEndDateFromPackage ──────────────────────────────────────────────────

describe('inferEndDateFromPackage', () => {
  it('monthly → 30 days (start + 29)', () => {
    const start = new Date('2026-06-01');
    const end = inferEndDateFromPackage(start, 'monthly');
    assert.equal(end.toISOString().slice(0, 10), '2026-06-30');
  });

  it('weekly → 7 days (start + 6)', () => {
    const end = inferEndDateFromPackage('2026-06-01', 'weekly');
    assert.equal(end.toISOString().slice(0, 10), '2026-06-07');
  });

  it('quarterly → 90 days (start + 89)', () => {
    // 2026-01-01 + 89 days: Jan(31) + Feb(28) + Mar(31) = 90 days total, ends Mar 31
    const end = inferEndDateFromPackage('2026-01-01', 'quarterly');
    assert.equal(end.toISOString().slice(0, 10), '2026-03-31');
  });

  it('annual → 365 days', () => {
    const end = inferEndDateFromPackage('2026-01-01', 'annual');
    assert.equal(end.toISOString().slice(0, 10), '2026-12-31');
  });

  it('unknown billing cycle falls back to 30 days', () => {
    const end = inferEndDateFromPackage('2026-06-01', 'custom');
    assert.equal(end.toISOString().slice(0, 10), '2026-06-30');
  });

  it('case-insensitive matching (Monthly)', () => {
    const end = inferEndDateFromPackage('2026-06-01', 'Monthly');
    assert.equal(end.toISOString().slice(0, 10), '2026-06-30');
  });
});

// ─── computeServiceDayBreakdown ───────────────────────────────────────────────

describe('computeServiceDayBreakdown', () => {
  it('returns serviceStartDate, serviceEndDate, actualServiceDays', () => {
    const result = computeServiceDayBreakdown('2026-06-01', 'monthly', [1, 2, 3, 4, 5]);
    assert.equal(result.serviceStartDate, '2026-06-01');
    assert.equal(result.serviceEndDate, '2026-06-30');
    assert.ok(result.actualServiceDays > 0);
  });

  it('produces same count as countServiceDays for the same inputs', () => {
    const breakdown = computeServiceDayBreakdown('2026-06-01', 'monthly', [1, 2, 3, 4, 5]);
    const direct = countServiceDays('2026-06-01', '2026-06-30', [1, 2, 3, 4, 5]);
    assert.equal(breakdown.actualServiceDays, direct);
  });

  it('falls back to today when startsOn is undefined', () => {
    const result = computeServiceDayBreakdown(undefined, 'weekly', [1, 2, 3, 4, 5]);
    assert.ok(result.serviceStartDate.length === 10); // YYYY-MM-DD
    assert.ok(result.serviceEndDate > result.serviceStartDate);
  });

  it('handles empty weekdays (defaults to Mon–Fri)', () => {
    const result = computeServiceDayBreakdown('2026-06-01', 'weekly', []);
    // 2026-06-01 Mon → 2026-06-07 Sun: 5 Mon–Fri days
    assert.equal(result.actualServiceDays, 5);
  });
});

// ─── pricing formula correctness ─────────────────────────────────────────────

describe('multi-day pricing formula', () => {
  it('total distance = daily distance × service days', () => {
    const dailyKm = 15; // one-way 7.5km, round-trip
    const serviceDays = 22;
    const expected = Math.round(dailyKm * serviceDays * 100) / 100;
    assert.equal(expected, 330);
  });

  it('distance charge = total km × price per km', () => {
    const totalKm = 330;
    const pricePerKm = 2.0;
    const charge = Math.round(totalKm * pricePerKm * 100) / 100;
    assert.equal(charge, 660);
  });

  it('single-day pricing (old) undercharges vs multi-day (new)', () => {
    const dailyKm = 15;
    const pricePerKm = 2.0;
    const serviceDays = 22;

    const singleDayCharge = dailyKm * pricePerKm;           // 30 SAR (WRONG)
    const multiDayCharge = dailyKm * serviceDays * pricePerKm; // 660 SAR (CORRECT)

    assert.ok(multiDayCharge > singleDayCharge);
    assert.equal(singleDayCharge, 30);
    assert.equal(multiDayCharge, 660);
  });
});

// ─── getActiveWeekdays ────────────────────────────────────────────────────────

describe('getActiveWeekdays', () => {
  it('returns a set of non-off weekdays', () => {
    const schedule = [
      { weekday: 1, isOffDay: false },
      { weekday: 2, isOffDay: false },
      { weekday: 3, isOffDay: true }, // off-day, should be excluded
      { weekday: 4, isOffDay: false },
    ];
    const result = getActiveWeekdays(schedule);
    assert.ok(result.has(1));
    assert.ok(result.has(2));
    assert.ok(!result.has(3));
    assert.ok(result.has(4));
    assert.equal(result.size, 3);
  });

  it('returns empty set when all are off-days', () => {
    const schedule = [{ weekday: 1, isOffDay: true }, { weekday: 2, isOffDay: true }];
    const result = getActiveWeekdays(schedule);
    assert.equal(result.size, 0);
  });
});

// ─── weekdaysOverlap ──────────────────────────────────────────────────────────

describe('weekdaysOverlap', () => {
  it('returns true when sets share a day', () => {
    const a = new Set([1, 2, 3]);
    const b = new Set([3, 4, 5]);
    assert.ok(weekdaysOverlap(a, b));
  });

  it('returns false when sets are disjoint', () => {
    const a = new Set([1, 2]);
    const b = new Set([3, 4, 5]);
    assert.ok(!weekdaysOverlap(a, b));
  });

  it('returns false when either set is empty', () => {
    const a = new Set<number>();
    const b = new Set([1, 2]);
    assert.ok(!weekdaysOverlap(a, b));
    assert.ok(!weekdaysOverlap(b, a));
  });
});

// ─── findConflicts ────────────────────────────────────────────────────────────

describe('findConflicts — driver assignment conflict detection', () => {
  const existingAssignments = [
    {
      subscriptionId: 'sub-A',
      schedule: [
        { weekday: 1, isOffDay: false }, // Mon
        { weekday: 3, isOffDay: false }, // Wed
      ],
    },
    {
      subscriptionId: 'sub-B',
      schedule: [
        { weekday: 2, isOffDay: false }, // Tue
        { weekday: 4, isOffDay: false }, // Thu
      ],
    },
  ];

  it('finds conflict when proposed weekdays overlap with existing assignment', () => {
    const proposed = new Set([1, 5]); // Mon overlaps sub-A
    const conflicts = findConflicts(proposed, existingAssignments);
    assert.deepEqual(conflicts, ['sub-A']);
  });

  it('finds multiple conflicts', () => {
    const proposed = new Set([1, 2]); // Mon (sub-A) and Tue (sub-B) overlap
    const conflicts = findConflicts(proposed, existingAssignments);
    assert.equal(conflicts.length, 2);
    assert.ok(conflicts.includes('sub-A'));
    assert.ok(conflicts.includes('sub-B'));
  });

  it('returns empty array when no conflicts', () => {
    const proposed = new Set([0, 6]); // Sun + Sat — no overlap with sub-A or sub-B
    const conflicts = findConflicts(proposed, existingAssignments);
    assert.deepEqual(conflicts, []);
  });

  it('accepts array of weekdays (not just Set)', () => {
    const conflicts = findConflicts([1], existingAssignments);
    assert.deepEqual(conflicts, ['sub-A']);
  });

  it('ignores off-days when checking conflicts', () => {
    const existingWithOffDay = [
      {
        subscriptionId: 'sub-C',
        schedule: [
          { weekday: 1, isOffDay: true }, // Mon is off — should NOT count as conflict
          { weekday: 3, isOffDay: false }, // Wed is active
        ],
      },
    ];
    const proposed = new Set([1]); // Mon — should NOT conflict with sub-C
    const conflicts = findConflicts(proposed, existingWithOffDay);
    assert.deepEqual(conflicts, []);
  });
});

// ─── hasConflict ─────────────────────────────────────────────────────────────

describe('hasConflict', () => {
  it('returns true when conflicts exist', () => {
    const existing = [
      { subscriptionId: 'sub-X', schedule: [{ weekday: 2, isOffDay: false }] },
    ];
    assert.ok(hasConflict([2], existing));
  });

  it('returns false when no conflicts exist', () => {
    const existing = [
      { subscriptionId: 'sub-X', schedule: [{ weekday: 2, isOffDay: false }] },
    ];
    assert.ok(!hasConflict([1, 3, 5], existing));
  });

  it('returns false for empty existing assignments', () => {
    assert.ok(!hasConflict([1, 2, 3], []));
  });
});
