import { describe, expect, it } from 'vitest';

import {
  beginDashboardMedicineLoad,
  canPreserveDashboardMedicines,
  failDashboardMedicineLoad,
  getDashboardMedicineContent,
  getInitialDashboardMedicineLoadState,
} from './dashboard-loading';

describe('dashboard medicine loading', () => {
  it('keeps the empty state hidden until the first medicine load succeeds', () => {
    expect(getInitialDashboardMedicineLoadState(false, 0)).toBe('loading');
    expect(getDashboardMedicineContent('loading', 0)).toBe('loading');
    expect(getDashboardMedicineContent('ready', 0)).toBe('empty');
  });

  it('renders a valid preloaded snapshot immediately', () => {
    expect(getInitialDashboardMedicineLoadState(true, 2)).toBe('ready');
    expect(getDashboardMedicineContent('ready', 2)).toBe('medicines');
  });

  it('revalidates a cached empty snapshot without flashing the empty state', () => {
    expect(getInitialDashboardMedicineLoadState(true, 0)).toBe('loading');
    expect(beginDashboardMedicineLoad('ready', 0)).toBe('loading');
  });

  it('keeps loaded content visible during a background refresh failure', () => {
    expect(beginDashboardMedicineLoad('ready', 2)).toBe('ready');
    expect(failDashboardMedicineLoad('ready')).toBe('ready');
  });

  it('never preserves another phone or day while loading reminders', () => {
    expect(
      canPreserveDashboardMedicines(
        '9876543210',
        '2026-07-30',
        '9876543210',
        '2026-07-30',
      ),
    ).toBe(true);
    expect(
      canPreserveDashboardMedicines(
        '9876543210',
        '2026-07-30',
        '9876543210',
        '2026-07-31',
      ),
    ).toBe(false);
    expect(
      canPreserveDashboardMedicines(
        '9876543210',
        '2026-07-30',
        '9123456780',
        '2026-07-30',
      ),
    ).toBe(false);
  });

  it('uses a retryable error state when the initial request fails', () => {
    expect(failDashboardMedicineLoad('loading')).toBe('error');
    expect(beginDashboardMedicineLoad('error', 0)).toBe('loading');
    expect(getDashboardMedicineContent('error', 0)).toBe('error');
  });
});
