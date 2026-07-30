import { describe, expect, it } from 'vitest';

import {
  DUMMY_MEDICINE_PRICE,
  formatRupees,
  formatShopProductPrice,
  resolveShopProductPrice,
} from './currency';

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

  it('shows the dummy placeholder price when a real price is not set yet', () => {
    expect(formatShopProductPrice(null)).toBe(`₹${DUMMY_MEDICINE_PRICE}`);
  });
});

describe('resolveShopProductPrice', () => {
  it('returns the real price when set', () => {
    expect(resolveShopProductPrice(32)).toBe(32);
  });

  it('returns the dummy placeholder price when missing', () => {
    expect(resolveShopProductPrice(null)).toBe(DUMMY_MEDICINE_PRICE);
  });
});
