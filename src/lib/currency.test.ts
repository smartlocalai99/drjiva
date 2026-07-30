import { describe, expect, it } from 'vitest';

import { formatRupees, formatShopProductPrice } from './currency';

describe('currency formatting', () => {
  it('keeps whole rupee values compact', () => {
    expect(formatRupees(120)).toBe('₹120');
  });

  it('rounds calculated decimal totals without floating-point artifacts', () => {
    expect(formatRupees(19.9 * 3)).toBe('₹59.70');
    expect(formatRupees(29.999)).toBe('₹30');
  });
});

describe('formatShopProductPrice', () => {
  it('formats a known price as rupees', () => {
    expect(formatShopProductPrice(32)).toBe('₹32');
  });

  it('labels a missing price as pending rather than free', () => {
    expect(formatShopProductPrice(null)).toBe(
      'Price confirmed before delivery',
    );
  });
});
