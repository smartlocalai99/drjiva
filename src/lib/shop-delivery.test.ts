import { describe, expect, it } from 'vitest';

import {
  SHOP_DELIVERY_ETA_LABEL,
  SHOP_DELIVERY_ETA_MINUTES,
} from './shop-delivery';

describe('shop delivery estimate', () => {
  it('uses the same 30-minute estimate throughout the shop', () => {
    expect(SHOP_DELIVERY_ETA_MINUTES).toBe(30);
    expect(SHOP_DELIVERY_ETA_LABEL).toBe('30 mins');
  });
});
