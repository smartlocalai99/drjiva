import { describe, expect, it } from 'vitest';

import { careDate, careText } from './careCopy';

describe('My Care copy', () => {
  it('fills in values in both languages', () => {
    expect(careText('en', 'weekOf40', { week: 18 })).toBe('Week 18 of 40');
    expect(careText('te', 'weekOf40', { week: 18 })).toBe('40 వారాల్లో 18వ వారం');
    expect(careText('en', 'updatedBy', { date: '13 Oct', nurse: 'Lakshmi' })).toBe('Updated by nurse Lakshmi on 13 Oct');
  });

  it('formats dates in English and Telugu', () => {
    expect(careDate('en', '2026-10-20', 'weekdayDayMonth')).toBe('Tue, 20 Oct');
    expect(careDate('te', '2026-10-20', 'weekdayDayMonth')).toBe('మంగళవారం, 20 అక్టోబర్');
    expect(careDate('en', '2027-03-12')).toBe('12 Mar 2027');
  });
});
