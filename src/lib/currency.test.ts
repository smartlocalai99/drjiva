import { describe, expect, it } from 'vitest';

import {
  DUMMY_MEDICINE_PRICE,
  SHOP_DISCOUNT_PERCENT,
  formatRupees,
  formatShopProductMrp,
  formatShopProductPrice,
  resolveShopProductMrp,
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
  it('formats the catalogue MRP with the five percent discount applied', () => {
    expect(formatShopProductPrice(100)).toBe('₹95');
  });

  it('discounts the placeholder MRP when a real price is not set yet', () => {
    expect(formatShopProductPrice(null)).toBe('₹46.55');
  });
});

describe('resolveShopProductPrice', () => {
  it('treats the catalogue price as MRP and applies five percent off', () => {
    expect(SHOP_DISCOUNT_PERCENT).toBe(5);
    expect(resolveShopProductPrice(32)).toBe(30.4);
  });

  it('uses and discounts the placeholder MRP when missing', () => {
    expect(resolveShopProductPrice(null)).toBe(46.55);
  });
});

describe('shop product MRP', () => {
  it('uses the database catalogue price directly as MRP', () => {
    expect(resolveShopProductMrp(32)).toBe(32);
    expect(formatShopProductMrp(32)).toBe('₹32');
  });

  it('uses the placeholder value as MRP when a price is missing', () => {
    expect(resolveShopProductMrp(null)).toBe(DUMMY_MEDICINE_PRICE);
  });
});
