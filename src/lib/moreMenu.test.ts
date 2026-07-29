import { describe, expect, it } from 'vitest';

import { getAccountMenuItems } from './moreMenu';

describe('getAccountMenuItems', () => {
  it('shows reminders below delivery addresses and above notification timings', () => {
    expect(getAccountMenuItems().map((item) => item.key)).toEqual([
      'profile',
      'savedAddresses',
      'reminders',
      'notificationTimings',
      'language',
    ]);
  });
});
