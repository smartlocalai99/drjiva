import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isNativeModuleAvailable } = vi.hoisted(() => ({
  isNativeModuleAvailable: vi.fn(),
}));

vi.mock('./nativeModuleAvailability', () => ({
  isNativeModuleAvailable,
}));

import {
  isExpoNotificationsAvailable,
  loadExpoNotifications,
  NOTIFICATIONS_REBUILD_MESSAGE,
  requireExpoNotifications,
} from './expoNotifications';

describe('expoNotifications', () => {
  beforeEach(() => {
    isNativeModuleAvailable.mockReset();
  });

  it('does not import notifications when the native module is missing', async () => {
    isNativeModuleAvailable.mockReturnValue(false);

    expect(isExpoNotificationsAvailable()).toBe(false);
    await expect(loadExpoNotifications()).resolves.toBeNull();
    await expect(requireExpoNotifications()).rejects.toThrow(
      NOTIFICATIONS_REBUILD_MESSAGE,
    );
    expect(isNativeModuleAvailable).toHaveBeenCalledWith(
      'ExpoPushTokenManager',
    );
  });
});
