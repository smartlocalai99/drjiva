import { describe, expect, it } from 'vitest';

import { careDate, careText } from './careCopy';

describe('My Care copy', () => {
  it('fills in values in both languages', () => {
    expect(careText('en', 'week', { week: 18 })).toBe('Week 18');
    expect(careText('te', 'week', { week: 18 })).toBe('18వ వారం');
    expect(careText('en', 'asBigAs', { fruit: 'a capsicum' })).toBe('As big as a capsicum');
    expect(careText('te', 'asBigAs', { fruit: 'క్యాప్సికం' })).toBe('క్యాప్సికం అంత ఉంటుంది');
    expect(careText('en', 'updatedBy', { date: '13 Oct', nurse: 'Lakshmi' })).toBe('Updated by nurse Lakshmi on 13 Oct');
  });

  it('formats dates in English and Telugu', () => {
    expect(careDate('en', '2026-10-20', 'weekdayDayMonth')).toBe('Tue, 20 Oct');
    expect(careDate('te', '2026-10-20', 'weekdayDayMonth')).toBe('మంగళవారం, 20 అక్టోబర్');
    expect(careDate('en', '2027-03-12')).toBe('12 Mar 2027');
  });
});

describe('pregnancy month and delivery wording', () => {
  it('says the month the way families count it', async () => {
    const { careMonth } = await import('./careCopy');
    const { pregnancyMonth } = await import('./careSchedule');
    expect([4, 5, 9, 13, 14, 27, 28, 36, 40].map(pregnancyMonth)).toEqual([1, 2, 3, 3, 4, 6, 7, 9, 9]);
    expect(careMonth('en', 3)).toBe('3rd month');
    expect(careMonth('en', 1)).toBe('1st month');
    expect(careMonth('te', 3)).toBe('3వ నెల');
    expect(careText('en', 'dueDate', { date: '26 May 2027' })).toBe('Expected delivery 26 May 2027');
  });
});
