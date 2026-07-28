import { describe, expect, it } from 'vitest';

import { getAccountMenuItems } from './moreMenu';

describe('getAccountMenuItems', () => {
  it('does not include saved addresses in Manage Profile', () => {
    expect(getAccountMenuItems().map((item) => item.key)).toEqual([
      'profile',
      'notificationTimings',
      'language',
    ]);
  });
});
