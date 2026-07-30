import { describe, expect, it } from 'vitest';

import { summarizeShopPricing } from './shop-pricing';

describe('summarizeShopPricing', () => {
  it('sums a fully-priced basket with no pending items', () => {
    expect(
      summarizeShopPricing([
        { price: 32, quantity: 2 },
        { price: 18, quantity: 1 },
      ]),
    ).toEqual({
      hasPendingPrices: false,
      knownSubtotal: 82,
      pendingItemCount: 0,
      pendingLineCount: 0,
    });
  });

  it('never treats a pending line as contributing zero to the known subtotal', () => {
    expect(
      summarizeShopPricing([
        { price: 32, quantity: 2 },
        { price: null, quantity: 3 },
      ]),
    ).toEqual({
      hasPendingPrices: true,
      knownSubtotal: 64,
      pendingItemCount: 3,
      pendingLineCount: 1,
    });
  });

  it('reports an all-pending basket with a zero known subtotal', () => {
    expect(
      summarizeShopPricing([
        { price: null, quantity: 1 },
        { price: null, quantity: 4 },
      ]),
    ).toEqual({
      hasPendingPrices: true,
      knownSubtotal: 0,
      pendingItemCount: 5,
      pendingLineCount: 2,
    });
  });

  it('returns an empty, non-pending summary for an empty basket', () => {
    expect(summarizeShopPricing([])).toEqual({
      hasPendingPrices: false,
      knownSubtotal: 0,
      pendingItemCount: 0,
      pendingLineCount: 0,
    });
  });
});
