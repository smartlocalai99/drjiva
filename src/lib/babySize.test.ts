import { describe, expect, it } from 'vitest';

import {
  BABY_WEEKS,
  babyScale,
  babyStage,
  babyWeek,
  clampBabyWeek,
  lengthAmount,
  lengthChange,
  weightAmount,
  weightChange,
} from './babySize';

describe('baby size table', () => {
  it('has every week from 4 to 40 with English and Telugu', () => {
    expect(BABY_WEEKS.map((row) => row.week)).toEqual(Array.from({ length: 37 }, (_, i) => i + 4));
    for (const row of BABY_WEEKS) {
      expect(row.likeEn).toMatch(/^an? /);
      expect(row.likeTe.length).toBeGreaterThan(0);
    }
  });

  it('only ever grows', () => {
    for (let i = 1; i < BABY_WEEKS.length; i += 1) {
      const before = BABY_WEEKS[i - 1]!;
      const now = BABY_WEEKS[i]!;
      expect(now.lengthCm).toBeGreaterThan(before.lengthCm);
      if (before.weightG !== null) expect(now.weightG).toBeGreaterThan(before.weightG);
      expect(babyScale(now.week)).toBeGreaterThanOrEqual(babyScale(before.week));
    }
  });

  it('matches the usual week 18 numbers', () => {
    expect(babyWeek(18)).toMatchObject({ lengthCm: 14.2, likeEn: 'a capsicum', weightG: 190 });
    expect(weightChange(18)).toBe(50);
    expect(lengthChange(18)).toBe(1.2);
  });

  it('skips changes that cannot be compared', () => {
    expect(weightChange(4)).toBeNull();
    expect(weightChange(8)).toBeNull(); // week 7 is under 1 g
    expect(lengthChange(4)).toBeNull();
    expect(lengthChange(20)).toBeNull(); // measured head to heel from here
    expect(lengthChange(21)).toBe(1.1);
  });

  it('keeps weeks inside 4 to 40', () => {
    expect(clampBabyWeek(0)).toBe(4);
    expect(clampBabyWeek(43)).toBe(40);
    expect(babyWeek(2).week).toBe(4);
    expect(babyWeek(41).week).toBe(40);
  });

  it('picks the drawing for each stage', () => {
    expect([4, 5, 8, 9, 13, 14, 27, 28, 40].map(babyStage)).toEqual([
      'cells', 'embryo', 'embryo', 'early', 'early', 'fetus', 'fetus', 'grown', 'grown',
    ]);
  });

  it('formats lengths and weights', () => {
    expect(lengthAmount(0.6)).toEqual({ amount: '6', unit: 'mm' });
    expect(lengthAmount(14.2)).toEqual({ amount: '14.2', unit: 'cm' });
    expect(lengthAmount(30)).toEqual({ amount: '30', unit: 'cm' });
    expect(lengthAmount(0.7, 1.3)).toEqual({ amount: '0.7', unit: 'cm' });
    expect(weightAmount(190)).toEqual({ amount: '190', unit: 'g' });
    expect(weightAmount(1005)).toEqual({ amount: '1', unit: 'kg' });
    expect(weightAmount(3462)).toEqual({ amount: '3.5', unit: 'kg' });
  });
});
