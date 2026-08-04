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
        medicineReminderChannel: 'medicine-reminders-loud-v3',
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
  groupDoseNotificationRequests,
  scheduleDoseNotifications,
  scheduleDoseNotificationsWithAdapter,
  scheduleGroupedDoseNotifications,
  scheduleGroupedDoseNotificationsWithAdapter,
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
    const notificationChannels: unknown[] = [];
    const scheduledRequests: unknown[] = [];
    requireExpoNotifications.mockResolvedValue({
      AndroidAudioContentType: { SPEECH: 'speech' },
      AndroidAudioUsage: { ALARM: 'alarm' },
      AndroidImportance: { MAX: 7 },
      SchedulableTriggerInputTypes: { DATE: 'date' },
      scheduleNotificationAsync: async (request: unknown) => {
        scheduledRequests.push(request);
        return 'notification-android-sound';
      },
      setNotificationChannelAsync: async (
        channelId: string,
        configuration: unknown,
      ) => {
        notificationChannels.push({ channelId, configuration });
      },
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
    expect(notificationChannels).toEqual([
      expect.objectContaining({
        channelId: 'medicine-reminders-loud-v3',
        configuration: expect.objectContaining({
          importance: 7,
          sound: 'rec',
        }),
      }),
    ]);
    expect(scheduledRequests[0]).toMatchObject({
      content: { sound: 'rec' },
      trigger: { channelId: 'medicine-reminders-loud-v3' },
    });
  });

  it('groups every medicine due at the exact same time', () => {
    const groups = groupDoseNotificationRequests([
      {
        eventId: 'dolo-event',
        medicineName: 'Dolo 650',
        scheduledFor: '2026-08-03T08:00:00.000Z',
        slot: 'Morning',
        slotKey: 'morning',
        tablets: 1,
      },
      {
        eventId: 'metformin-event',
        medicineName: 'Metformin',
        scheduledFor: '2026-08-03T08:00:00.000Z',
        slot: 'Morning',
        slotKey: 'morning',
        tablets: 2,
      },
      {
        eventId: 'night-event',
        medicineName: 'Dolo 650',
        scheduledFor: '2026-08-03T20:00:00.000Z',
        slot: 'Night',
        slotKey: 'night',
        tablets: 1,
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.reminders.map((item) => item.eventId)).toEqual([
      'dolo-event',
      'metformin-event',
    ]);
  });

  it('links one grouped phone alert to every dose event at that time', async () => {
    const identifiers = await scheduleGroupedDoseNotificationsWithAdapter(
      {
        cancel: vi.fn(async () => undefined),
        schedule: vi.fn(async () => 'one-alert'),
      },
      [
        {
          eventId: 'event-1',
          medicineName: 'Dolo 650',
          scheduledFor: '2026-08-03T08:00:00.000Z',
          slot: 'Morning',
          slotKey: 'morning',
          tablets: 1,
        },
        {
          eventId: 'event-2',
          medicineName: 'Metformin',
          scheduledFor: '2026-08-03T08:00:00.000Z',
          slot: 'Morning',
          slotKey: 'morning',
          tablets: 1,
        },
      ],
    );

    expect(identifiers).toEqual([
      { eventId: 'event-1', notificationId: 'one-alert' },
      { eventId: 'event-2', notificationId: 'one-alert' },
    ]);
  });

  it('creates one combined operating-system notification for same-time medicines', async () => {
    const scheduledRequests: unknown[] = [];
    requireExpoNotifications.mockResolvedValue({
      SchedulableTriggerInputTypes: { DATE: 'date' },
      cancelScheduledNotificationAsync: async () => undefined,
      scheduleNotificationAsync: async (request: unknown) => {
        scheduledRequests.push(request);
        return 'combined-alert';
      },
    });
    const scheduledFor = new Date(Date.now() + 60_000).toISOString();

    const identifiers = await scheduleGroupedDoseNotifications([
      {
        eventId: 'event-1',
        medicineName: 'Dolo 650',
        scheduledFor,
        slot: 'Morning',
        slotKey: 'morning',
        tablets: 1,
      },
      {
        eventId: 'event-2',
        medicineName: 'Metformin',
        scheduledFor,
        slot: 'Morning',
        slotKey: 'morning',
        tablets: 2,
      },
    ]);

    expect(scheduledRequests).toHaveLength(1);
    expect(scheduledRequests[0]).toMatchObject({
      content: {
        data: { eventIds: ['event-1', 'event-2'] },
        title: 'Time for 2 medicines',
      },
    });
    expect(identifiers).toEqual([
      { eventId: 'event-1', notificationId: 'combined-alert' },
      { eventId: 'event-2', notificationId: 'combined-alert' },
    ]);
  });
});
