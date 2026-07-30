import { describe, expect, it, vi } from 'vitest';

// medicineNotifications.ts statically imports Platform from react-native.
// react-native's real source isn't parseable outside Metro's transform, so
// it's mocked here rather than letting Vitest try to load it directly.
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        medicineReminderChannel: 'medicine-reminders',
        medicineReminderSound: false,
      },
    },
  },
}));
vi.mock('./expoNotifications', () => ({
  requireExpoNotifications: vi.fn(),
}));

import { scheduleDoseNotificationsWithAdapter } from './medicineNotifications';

describe('scheduleDoseNotificationsWithAdapter', () => {
  it('cancels already-created notifications after partial failure', async () => {
    const cancelled: string[] = [];
    let calls = 0;

    await expect(
      scheduleDoseNotificationsWithAdapter(
        {
          cancel: async (id) => {
            cancelled.push(id);
          },
          schedule: async () => {
            calls += 1;
            if (calls === 2) throw new Error('schedule failed');
            return 'notification-1';
          },
        },
        [
          { eventId: 'event-1', scheduledFor: '2026-08-01T08:00:00.000Z' },
          { eventId: 'event-2', scheduledFor: '2026-08-01T13:00:00.000Z' },
        ],
        {
          medicineName: 'Dolo 650',
          slot: 'Morning',
          slotKey: 'morning',
          tablets: 1,
        },
      ),
    ).rejects.toThrow('schedule failed');

    expect(cancelled).toEqual(['notification-1']);
  });
});
