import { describe, expect, it } from 'vitest';

import {
  matchesMedicineSearch,
  normalizeMedicineSearch,
} from './medicineSearch';

describe('medicine search', () => {
  it('normalizes punctuation, case, and whitespace', () => {
    expect(normalizeMedicineSearch('  Dolo-650  TABLET ')).toBe(
      'dolo 650 tablet',
    );
  });

  it('matches partial normalized medicine names', () => {
    expect(matchesMedicineSearch('Dolo 650 Tablet', ' dolo 650 ')).toBe(true);
    expect(matchesMedicineSearch('Paracetamol', 'CETAM')).toBe(true);
    expect(matchesMedicineSearch('Amoxicillin', 'paracetamol')).toBe(false);
  });
});
