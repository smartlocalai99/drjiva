import { describe, expect, it } from 'vitest';

import {
  buildCustomMedicinePath,
  normalizeCustomMedicineName,
} from './customMedicines';

describe('custom medicine storage', () => {
  it('keeps every image inside the signed-in owner folder', () => {
    expect(buildCustomMedicinePath('owner-1', 'my pill.PNG')).toMatch(
      /^owner-1\/[0-9a-f-]+\.jpg$/,
    );
  });

  it('normalizes names for owner-scoped uniqueness', () => {
    expect(normalizeCustomMedicineName('  Dolo   650  ')).toBe('dolo 650');
  });
});
