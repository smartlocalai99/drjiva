import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPlatform, requireExpoNotifications } = vi.hoisted(() => ({
  mockPlatform: { OS: 'ios' as string },
  requireExpoNotifications: vi.fn(),
}));

// medicineNotifications.ts statically imports Platform from react-native.
// react-native's real source isn't parseable outside Metro's transform, so
// it's mocked here rather than letting Vitest try to load it directly.
vi.mock('react-native', () => ({ Platform: mockPlatform }));
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        medicineReminderChannel: 'medicine-reminders',
        medicineReminderSoundAndroid: 'rec',
        medicineReminderSoundIOS: 'reminder.caf',
      },
    },
  },
}));
vi.mock('./expoNotifications', () => ({
  requireExpoNotifications,
}));

import {
  scheduleDoseNotifications,
  scheduleDoseNotificationsWithAdapter,
} from './medicineNotifications';

describe('scheduleDoseNotificationsWithAdapter', () => {
  beforeEach(() => {
    requireExpoNotifications.mockReset();
    mockPlatform.OS = 'ios';
  });

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

  it('places the configured custom sound in scheduled notification content', async () => {
    const scheduledRequests: unknown[] = [];
    requireExpoNotifications.mockResolvedValue({
      SchedulableTriggerInputTypes: { DATE: 'date' },
      scheduleNotificationAsync: async (request: unknown) => {
        scheduledRequests.push(request);
        return 'notification-custom-sound';
      },
    });

    await scheduleDoseNotifications(
      [
        {
          eventId: 'event-custom-sound',
          scheduledFor: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
      {
        medicineName: 'Dolo 650',
        slot: 'Morning',
        slotKey: 'morning',
        tablets: 1,
      },
    );

    expect(scheduledRequests).toHaveLength(1);
    expect(scheduledRequests[0]).toMatchObject({
      content: { sound: 'reminder.caf' },
    });
  });

  it('uses the Android sound resource name on Android', async () => {
    mockPlatform.OS = 'android';
    const scheduledRequests: unknown[] = [];
    requireExpoNotifications.mockResolvedValue({
      AndroidAudioContentType: { SPEECH: 'speech' },
      AndroidAudioUsage: { ALARM: 'alarm' },
      AndroidImportance: { MAX: 5 },
      SchedulableTriggerInputTypes: { DATE: 'date' },
      scheduleNotificationAsync: async (request: unknown) => {
        scheduledRequests.push(request);
        return 'notification-android-sound';
      },
      setNotificationChannelAsync: async () => undefined,
    });

    await scheduleDoseNotifications(
      [
        {
          eventId: 'event-android-sound',
          scheduledFor: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
      {
        medicineName: 'Dolo 650',
        slot: 'Morning',
        slotKey: 'morning',
        tablets: 1,
      },
    );

    expect(scheduledRequests).toHaveLength(1);
    expect(scheduledRequests[0]).toMatchObject({
      content: { sound: 'rec' },
    });
  });
});
