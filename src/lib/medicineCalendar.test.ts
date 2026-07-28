import { describe, expect, it } from 'vitest';

import {
  getCalendarCells,
  getCourseEndDate,
  getInitialTimelineDate,
  isCourseDoseDate,
  isDateInRange,
  parseDateOnly,
} from './medicineCalendar';

describe('medicine calendar', () => {
  it('builds a six-week calendar grid', () => {
    const cells = getCalendarCells(2026, 6);
    expect(cells).toHaveLength(42);
    expect(cells.find((cell) => cell.date === '2026-07-01')?.inMonth).toBe(true);
  });

  it('marks every calendar day in a selected course range', () => {
    expect(getCourseEndDate('2026-07-01', 10)).toBe('2026-07-10');
    expect(isDateInRange('2026-07-06', '2026-07-01', 10)).toBe(true);
    expect(isDateInRange('2026-07-11', '2026-07-01', 10)).toBe(false);
  });

  it('marks only scheduled dates for alternate-day courses', () => {
    expect(isCourseDoseDate('2026-07-29', '2026-07-29', 7, 'alternate')).toBe(
      true,
    );
    expect(isCourseDoseDate('2026-07-30', '2026-07-29', 7, 'alternate')).toBe(
      false,
    );
    expect(isCourseDoseDate('2026-07-31', '2026-07-29', 7, 'alternate')).toBe(
      true,
    );
    expect(isCourseDoseDate('2026-08-05', '2026-07-29', 7, 'alternate')).toBe(
      false,
    );
    expect(isCourseDoseDate('2026-07-30', '2026-07-29', 7, 'daily')).toBe(
      true,
    );
  });

  it('rejects impossible dates', () => {
    expect(parseDateOnly('2026-02-30')).toBeNull();
  });

  it('opens the dashboard timeline on a later selected course date', () => {
    const today = new Date(2026, 6, 29);

    expect(getInitialTimelineDate('2026-08-12', today)).toEqual(
      new Date(2026, 7, 12),
    );
    expect(getInitialTimelineDate('not-a-date', today)).toBe(today);
  });
});
