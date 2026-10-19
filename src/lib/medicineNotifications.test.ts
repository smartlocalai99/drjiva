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
  findScheduledDoseNotificationIds,
  groupDoseNotificationRequests,
  MIN_MEDICINE_ALERTS_IOS,
  scheduleDoseNotifications,
  scheduleDoseNotificationsWithAdapter,
  scheduleGroupedDoseNotifications,
  scheduleGroupedDoseNotificationsWithAdapter,
  scheduledDoseEventIds,
  upcomingAlertEventIds,
} from './medicineNotifications';

describe('findScheduledDoseNotificationIds', () => {
  it('finds every old phone alert linked to a dose event and deduplicates ids', () => {
    expect(
      findScheduledDoseNotificationIds(
        [
          {
            content: { data: { eventId: 'event-1' } },
            identifier: 'old-single',
          },
          {
            content: { data: { eventIds: ['event-1', 'event-2'] } },
            identifier: 'old-group',
          },
          {
            content: { data: { eventId: 'unrelated' } },
            identifier: 'keep-me',
          },
        ],
        ['event-1', 'event-2'],
      ),
    ).toEqual(['old-single', 'old-group']);
  });
});

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

  it('rings once per minute: doses a few seconds apart share the earliest alert', () => {
    const groups = groupDoseNotificationRequests([
      {
        eventId: 'late-seconds',
        medicineName: 'Metformin',
        scheduledFor: '2026-08-03T08:00:40.000Z',
        slot: 'Morning',
        slotKey: 'morning',
        tablets: 2,
      },
      {
        eventId: 'on-the-minute',
        medicineName: 'Dolo 650',
        scheduledFor: '2026-08-03T08:00:00.000Z',
        slot: 'Morning',
        slotKey: 'morning',
        tablets: 1,
      },
      {
        eventId: 'next-minute',
        medicineName: 'Pan 40',
        scheduledFor: '2026-08-03T08:01:00.000Z',
        slot: 'Morning',
        slotKey: 'morning',
        tablets: 1,
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ scheduledFor: '2026-08-03T08:00:00.000Z' });
    expect(groups[0]?.reminders.map((item) => item.eventId)).toEqual(['late-seconds', 'on-the-minute']);
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
      getAllScheduledNotificationsAsync: async () => [],
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

describe('phone alert limits and the app-open check', () => {
  const at = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
  const dose = (eventId: string, minutes: number) => ({
    eventId,
    medicineName: `Medicine ${eventId}`,
    scheduledFor: at(minutes),
    slot: 'Morning',
    slotKey: 'morning' as const,
    tablets: 1,
  });
  const fakeNotifications = (requests: unknown[], waitingOthers = 0) => ({
    AndroidAudioContentType: { SPEECH: 1 },
    AndroidAudioUsage: { ALARM: 4 },
    AndroidImportance: { MAX: 5 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    cancelScheduledNotificationAsync: async () => undefined,
    // Visit / vaccine reminders already waiting on the phone.
    getAllScheduledNotificationsAsync: async () =>
      Array.from({ length: waitingOthers }, (_, i) => ({ content: { data: { type: 'care_followup' } }, identifier: `visit-${i}` })),
    scheduleNotificationAsync: async (request: unknown) => {
      requests.push(request);
      return `alert-${requests.length}`;
    },
    setNotificationChannelAsync: async () => undefined,
  });

  beforeEach(() => {
    mockPlatform.OS = 'ios';
  });

  it('fills an iPhone up to 60 alerts when nothing else is waiting (iOS keeps 64)', async () => {
    const requests: unknown[] = [];
    requireExpoNotifications.mockResolvedValue(fakeNotifications(requests));
    const doses = Array.from({ length: 70 }, (_, i) => dose(`d${i}`, 60 * (i + 1)));

    const identifiers = await scheduleGroupedDoseNotifications(doses);

    expect(requests).toHaveLength(60);
    expect(identifiers.map((item) => item.eventId)).toEqual(doses.slice(0, 60).map((item) => item.eventId));
  });

  it('leaves room on an iPhone for the visit and vaccine reminders already waiting', async () => {
    const requests: unknown[] = [];
    requireExpoNotifications.mockResolvedValue(fakeNotifications(requests, 16));
    const doses = Array.from({ length: 70 }, (_, i) => dose(`d${i}`, 60 * (i + 1)));

    await scheduleGroupedDoseNotifications(doses);

    expect(requests).toHaveLength(44);
  });

  it('never sets fewer than 30 medicine alerts on an iPhone', async () => {
    const requests: unknown[] = [];
    requireExpoNotifications.mockResolvedValue(fakeNotifications(requests, 50));
    const doses = Array.from({ length: 70 }, (_, i) => dose(`d${i}`, 60 * (i + 1)));

    await scheduleGroupedDoseNotifications(doses);

    expect(requests).toHaveLength(MIN_MEDICINE_ALERTS_IOS);
  });

  it('keeps the Telugu voice: grouped iPhone alerts play reminder.caf', async () => {
    const requests: Array<{ content: { sound: string } }> = [];
    requireExpoNotifications.mockResolvedValue(fakeNotifications(requests));

    await scheduleGroupedDoseNotifications([dose('a', 30), dose('b', 30)]);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ content: { sound: 'reminder.caf' } });
  });

  it('keeps the Telugu voice: grouped Android alerts use the rec sound channel', async () => {
    mockPlatform.OS = 'android';
    const requests: unknown[] = [];
    requireExpoNotifications.mockResolvedValue(fakeNotifications(requests));

    await scheduleGroupedDoseNotifications([dose('a', 30), dose('b', 30)]);

    expect(requests[0]).toMatchObject({
      content: { sound: 'rec' },
      trigger: { channelId: 'medicine-reminders-loud-v3' },
    });
  });

  it('lists the doses of the next alert times only, skipping past ones', () => {
    const doses = [dose('past', -10), dose('first-a', 10), dose('first-b', 10), dose('second', 20), dose('third', 30)];

    expect(upcomingAlertEventIds(doses, 2)).toEqual(['first-a', 'first-b', 'second']);
  });

  it('reads the doses behind every waiting alert, old single and new grouped', () => {
    expect(
      scheduledDoseEventIds([
        { content: { data: { eventId: 'old-single' } }, identifier: '1' },
        { content: { data: { eventId: 'g1', eventIds: ['g1', 'g2'] } }, identifier: '2' },
        { content: { data: { type: 'care_followup' } }, identifier: 'visit' },
      ]),
    ).toEqual(new Set(['old-single', 'g1', 'g2']));
  });
});

