import { describe, expect, it } from 'vitest';

import { getTabRoute } from './dashboardNav';

describe('dashboard tab routes', () => {
  it('maps the four visible tabs to their screens', () => {
    expect(getTabRoute('today')).toBe('/home');
    expect(getTabRoute('documents')).toBe('/documents');
    expect(getTabRoute('healthFeed')).toBe('/health-feed');
    expect(getTabRoute('shop')).toBe('/shop');
  });
});
