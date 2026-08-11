import { describe, expect, it } from 'vitest';

import { getShopProductRating } from './shop-product-rating';

describe('getShopProductRating', () => {
  it('returns stable product-specific rating details', () => {
    expect(getShopProductRating('medicine-1', 'Dolo 650')).toEqual(
      getShopProductRating('medicine-1', 'Dolo 650'),
    );
  });

  it('keeps ratings and counts inside the shop display range', () => {
    const result = getShopProductRating('medicine-2', 'Vitamin tablets');

    expect(Number(result.label)).toBeGreaterThanOrEqual(4.3);
    expect(Number(result.label)).toBeLessThanOrEqual(5);
    expect(result.count).toBeGreaterThanOrEqual(120);
    expect(result.count).toBeLessThanOrEqual(1500);
    expect(result.recentOrders).toBeGreaterThanOrEqual(18);
    expect(result.recentOrders).toBeLessThanOrEqual(96);
  });

  it('varies recent order activity between products', () => {
    const recentOrderCounts = Array.from({ length: 8 }, (_, index) =>
      getShopProductRating(`medicine-${index}`, `Medicine ${index}`),
    ).map(({ recentOrders }) => recentOrders);

    expect(new Set(recentOrderCounts).size).toBeGreaterThan(1);
  });
});
