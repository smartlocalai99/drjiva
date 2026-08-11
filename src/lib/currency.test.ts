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
  it('formats the catalogue selling price as rupees', () => {
    expect(formatShopProductPrice(32)).toBe('₹32');
  });

  it('shows the dummy placeholder price when a real price is not set yet', () => {
    expect(formatShopProductPrice(null)).toBe(`₹${DUMMY_MEDICINE_PRICE}`);
  });
});

describe('resolveShopProductPrice', () => {
  it('keeps the catalogue price as the discounted selling price', () => {
    expect(SHOP_DISCOUNT_PERCENT).toBe(15);
    expect(resolveShopProductPrice(32)).toBe(32);
  });

  it('uses the placeholder selling price when missing', () => {
    expect(resolveShopProductPrice(null)).toBe(DUMMY_MEDICINE_PRICE);
  });
});

describe('shop product MRP', () => {
  it('derives MRP from the selling price and advertised discount', () => {
    expect(resolveShopProductMrp(32)).toBe(37.65);
    expect(formatShopProductMrp(32)).toBe('₹37.65');
  });

  it('derives a placeholder MRP when a price is missing', () => {
    expect(resolveShopProductMrp(null)).toBe(57.65);
  });
});
