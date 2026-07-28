import { describe, expect, it } from 'vitest';

import { getDateMarker } from './dateMarker';

describe('date marker', () => {
  it('prioritizes the today streak over selected styling', () => {
    expect(getDateMarker(true, true)).toBe('today-streak');
    expect(getDateMarker(true, false)).toBe('today-streak');
  });

  it('keeps the selected gradient for dates other than today', () => {
    expect(getDateMarker(false, true)).toBe('selected-gradient');
  });

  it('leaves unselected dates plain', () => {
    expect(getDateMarker(false, false)).toBe('plain');
  });
});
