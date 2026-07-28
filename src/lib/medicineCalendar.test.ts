import { describe, expect, it } from 'vitest';

import {
  getCalendarCells,
  getCourseEndDate,
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

  it('rejects impossible dates', () => {
    expect(parseDateOnly('2026-02-30')).toBeNull();
  });
});
