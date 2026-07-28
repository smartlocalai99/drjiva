import { describe, expect, it } from 'vitest';

import { getAccountMenuItems } from './moreMenu';

describe('getAccountMenuItems', () => {
  it('shows delivery addresses above notification timings', () => {
    expect(getAccountMenuItems().map((item) => item.key)).toEqual([
      'profile',
      'savedAddresses',
      'notificationTimings',
      'language',
    ]);
  });
});
