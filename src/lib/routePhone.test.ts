import { describe, expect, it } from 'vitest';

import { normalizeRoutePhone } from './routePhone';

describe('normalizeRoutePhone', () => {
  it('normalizes a single route value', () => {
    expect(normalizeRoutePhone('+91 98765 43210')).toBe('9876543210');
  });

  it('handles Expo Router duplicate parameters', () => {
    expect(normalizeRoutePhone(['9876543210', '9876543210'])).toBe(
      '9876543210',
    );
  });

  it('returns an empty value when the route has no phone', () => {
    expect(normalizeRoutePhone(undefined)).toBe('');
  });
});
