import { describe, expect, it } from 'vitest';

import {
  adjustTime,
  areSelectedSlotTimesOrdered,
  dateToStoredTime,
  formatTime12Hour,
  fromTimeParts,
  isStoredTime,
  storedTimeToDate,
  toTimeParts,
} from './medicineTime';

describe('direct time parts', () => {
  it('converts midnight, noon, and exact minutes without rounding', () => {
    expect(toTimeParts('00:08')).toEqual({ hour: 12, minute: 8, period: 'AM' });
    expect(toTimeParts('12:59')).toEqual({ hour: 12, minute: 59, period: 'PM' });
    expect(fromTimeParts({ hour: 1, minute: 8, period: 'PM' })).toBe('13:08');
  });
});

describe('medicine time helpers', () => {
  it('shows stored times in 12-hour format', () => {
    expect(formatTime12Hour('00:00')).toBe('12:00 AM');
    expect(formatTime12Hour('08:15')).toBe('8:15 AM');
    expect(formatTime12Hour('13:00')).toBe('1:00 PM');
    expect(formatTime12Hour('20:30')).toBe('8:30 PM');
  });

  it('moves times in selectable steps', () => {
    expect(adjustTime('08:00', 15)).toBe('08:15');
    expect(adjustTime('00:00', -15)).toBe('23:45');
  });

  it('round-trips native picker dates to stored reminder times', () => {
    const date = storedTimeToDate('19:35', new Date(2026, 6, 29, 8, 0));
    expect([date.getHours(), date.getMinutes(), date.getSeconds()]).toEqual([
      19,
      35,
      0,
    ]);
    expect(dateToStoredTime(date)).toBe('19:35');
  });

  it('validates only the selected periods in their natural order', () => {
    const times = {
      afternoon: '13:00',
      morning: '08:00',
      night: '20:00',
    };
    expect(isStoredTime(times.morning)).toBe(true);
    expect(areSelectedSlotTimesOrdered(['morning', 'night'], times)).toBe(true);
    expect(
      areSelectedSlotTimesOrdered(['morning', 'night'], {
        ...times,
        morning: '21:00',
      }),
    ).toBe(false);
  });
});
