import { describe, expect, it } from 'vitest';

import { BABY_WEEKS } from './babySize';
import { CARE_PHOTO_CREDITS } from './careCredits';

const FREE = /^(Public domain|CC0|CC BY(-SA)? \d\.\d)$/;

describe('My Care photo credits', () => {
  it('credits every fruit picture and every baby stage', () => {
    const keys = new Set(CARE_PHOTO_CREDITS.map((credit) => credit.key));
    for (const week of BABY_WEEKS) expect(keys).toContain(week.photo);
    for (const stage of ['baby-cells', 'baby-embryo', 'baby-fetus', 'baby-grown']) expect(keys).toContain(stage);
    expect(keys.size).toBe(CARE_PHOTO_CREDITS.length);
  });

  it('only uses free licences, with a link where the licence needs one', () => {
    for (const credit of CARE_PHOTO_CREDITS) {
      expect(credit.license).toMatch(FREE);
      expect(credit.source).toMatch(/^https:\/\//);
      expect(credit.by.length).toBeGreaterThan(1);
      if (/^CC BY/.test(credit.license)) expect(credit.licenseUrl).toMatch(/^https?:\/\/creativecommons\.org\//);
    }
  });
});
