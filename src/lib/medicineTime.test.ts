import { describe, expect, it } from 'vitest';

import {
  adjustTime,
  areSelectedSlotTimesOrdered,
  formatTime12Hour,
  isStoredTime,
} from './medicineTime';

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
