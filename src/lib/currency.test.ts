import { describe, expect, it } from 'vitest';

import { formatRupees } from './currency';

describe('currency formatting', () => {
  it('keeps whole rupee values compact', () => {
    expect(formatRupees(120)).toBe('₹120');
  });

  it('rounds calculated decimal totals without floating-point artifacts', () => {
    expect(formatRupees(19.9 * 3)).toBe('₹59.70');
    expect(formatRupees(29.999)).toBe('₹30');
  });
});
