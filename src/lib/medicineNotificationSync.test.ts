import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cancelDoseNotifications,
  cancelScheduledDoseNotificationsForEvents,
  fetchDeviceDoseRemindersFromToday,
  listScheduledDoseEventIds,
  queueNotificationCancellations,
  saveNotificationIds,
  scheduleGroupedDoseNotifications,
} = vi.hoisted(() => ({
  cancelDoseNotifications: vi.fn(async () => undefined),
  cancelScheduledDoseNotificationsForEvents: vi.fn(async () => undefined),
  fetchDeviceDoseRemindersFromToday: vi.fn(),
  listScheduledDoseEventIds: vi.fn(),
  queueNotificationCancellations: vi.fn(async () => undefined),
  saveNotificationIds: vi.fn(async () => undefined),
  scheduleGroupedDoseNotifications: vi.fn(),
}));

vi.mock('./medicineCourses', () => ({
  fetchDeviceDoseRemindersFromToday,
  saveNotificationIds,
}));
vi.mock('./medicineNotifications', async (importOriginal) => ({
  cancelDoseNotifications,
  cancelScheduledDoseNotificationsForEvents,
  listScheduledDoseEventIds,
  queueNotificationCancellations,
  scheduleGroupedDoseNotifications,
  // Pure: which doses the next alert times cover.
  upcomingAlertEventIds: (await importOriginal<typeof import('./medicineNotifications')>()).upcomingAlertEventIds,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock('./expoNotifications', () => ({ requireExpoNotifications: vi.fn() }));

import {
  DEVICE_ALARM_CHECK_COUNT,
  ensureDeviceDoseAlarms,
  syncDoseNotifications,
  syncPatientDoseNotifications,
} from './medicineNotificationSync';

const reminder = {
  eventId: 'event-1',
  medicineName: 'Dolo 650',
  notificationId: 'stored-old-id',
  scheduledFor: '2026-08-20T08:00:00.000Z',
  slot: 'morning' as const,
  tablets: 1,
};

describe('syncDoseNotifications', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchDeviceDoseRemindersFromToday.mockResolvedValue([reminder]);
    scheduleGroupedDoseNotifications.mockResolvedValue([
      { eventId: 'event-1', notificationId: 'new-id' },
    ]);
  });

  it('removes stored and orphaned scheduled alerts before creating one replacement', async () => {
    await syncDoseNotifications([reminder]);

    expect(cancelDoseNotifications).toHaveBeenCalledWith(['stored-old-id']);
    expect(cancelScheduledDoseNotificationsForEvents).toHaveBeenCalledWith([
      'event-1',
    ]);
    expect(scheduleGroupedDoseNotifications).toHaveBeenCalledOnce();
    expect(saveNotificationIds).toHaveBeenCalledWith([
      { eventId: 'event-1', notificationId: 'new-id' },
    ]);
  });

  it('does not schedule a replacement when old alerts cannot be reconciled', async () => {
    cancelScheduledDoseNotificationsForEvents.mockRejectedValueOnce(
      new Error('cancel failed'),
    );

    await expect(syncDoseNotifications([reminder])).rejects.toThrow(
      'cancel failed',
    );
    expect(queueNotificationCancellations).toHaveBeenCalledWith([
      'stored-old-id',
    ]);
    expect(scheduleGroupedDoseNotifications).not.toHaveBeenCalled();
    expect(cancelDoseNotifications).not.toHaveBeenCalled();
  });

  it('fetches each patient schedule inside the queue after the previous sync saves', async () => {
    const operations: string[] = [];
    fetchDeviceDoseRemindersFromToday.mockImplementation(async () => {
      operations.push('fetch');
      return [reminder];
    });
    scheduleGroupedDoseNotifications.mockImplementation(async () => {
      operations.push('schedule');
      return [{ eventId: 'event-1', notificationId: 'new-id' }];
    });
    saveNotificationIds.mockImplementation(async () => {
      operations.push('save');
    });

    await Promise.all([
      syncPatientDoseNotifications('patient-1'),
      syncPatientDoseNotifications('patient-1'),
    ]);

    expect(operations).toEqual([
      'fetch', 'schedule', 'save', 'fetch', 'schedule', 'save',
    ]);
  });

  it('allows the next sync to recover after saving identifiers fails', async () => {
    saveNotificationIds.mockRejectedValueOnce(new Error('save failed'));

    await expect(syncDoseNotifications([reminder])).rejects.toThrow('save failed');
    await expect(syncPatientDoseNotifications('patient-1')).resolves.toEqual({
      cleanupPending: false,
    });
    expect(saveNotificationIds).toHaveBeenCalledTimes(2);
  });
});

describe('ensureDeviceDoseAlarms (app open)', () => {
  const soon = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
  const dose = (eventId: string, minutes: number) => ({
    eventId,
    medicineName: 'Dolo 650',
    notificationId: `stored-${eventId}`,
    scheduledFor: soon(minutes),
    slot: 'morning' as const,
    tablets: 1,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    scheduleGroupedDoseNotifications.mockResolvedValue([]);
  });

  it('leaves the alarms alone when the phone already has every upcoming dose', async () => {
    fetchDeviceDoseRemindersFromToday.mockResolvedValue([dose('a', 60), dose('b', 60), dose('c', 600)]);
    listScheduledDoseEventIds.mockResolvedValue(new Set(['a', 'b', 'c']));

    await expect(ensureDeviceDoseAlarms()).resolves.toBe('ok');
    expect(scheduleGroupedDoseNotifications).not.toHaveBeenCalled();
    expect(saveNotificationIds).not.toHaveBeenCalled();
  });

  it('rebuilds when a dose added from another phone has no alarm here', async () => {
    fetchDeviceDoseRemindersFromToday.mockResolvedValue([dose('a', 60), dose('from-other-phone', 120)]);
    listScheduledDoseEventIds.mockResolvedValue(new Set(['a']));

    await expect(ensureDeviceDoseAlarms()).resolves.toBe('rebuilt');
    expect(cancelScheduledDoseNotificationsForEvents).toHaveBeenCalledWith(['a', 'from-other-phone']);
    expect(scheduleGroupedDoseNotifications).toHaveBeenCalledOnce();
    expect(saveNotificationIds).toHaveBeenCalledOnce();
  });

  it('only checks the next alert times, not doses weeks away', async () => {
    const near = Array.from({ length: DEVICE_ALARM_CHECK_COUNT }, (_, i) => dose(`near-${i}`, 60 * (i + 1)));
    fetchDeviceDoseRemindersFromToday.mockResolvedValue([...near, dose('far-away', 60 * 24 * 30)]);
    listScheduledDoseEventIds.mockResolvedValue(new Set(near.map((item) => item.eventId)));

    await expect(ensureDeviceDoseAlarms()).resolves.toBe('ok');
    expect(scheduleGroupedDoseNotifications).not.toHaveBeenCalled();
  });

  it('does not read the phone when there is nothing upcoming (past doses only)', async () => {
    fetchDeviceDoseRemindersFromToday.mockResolvedValue([dose('earlier-today', -60)]);

    await expect(ensureDeviceDoseAlarms()).resolves.toBe('ok');
    expect(listScheduledDoseEventIds).not.toHaveBeenCalled();
    expect(scheduleGroupedDoseNotifications).not.toHaveBeenCalled();
  });

  it('waits for a running medicine save before checking', async () => {
    const operations: string[] = [];
    fetchDeviceDoseRemindersFromToday.mockImplementation(async () => {
      operations.push('fetch');
      return [dose('a', 60)];
    });
    scheduleGroupedDoseNotifications.mockImplementation(async () => {
      operations.push('schedule');
      return [{ eventId: 'a', notificationId: 'new-a' }];
    });
    listScheduledDoseEventIds.mockImplementation(async () => {
      operations.push('check');
      return new Set(['a']);
    });

    await Promise.all([syncPatientDoseNotifications('patient-1'), ensureDeviceDoseAlarms()]);

    expect(operations).toEqual(['fetch', 'schedule', 'fetch', 'check']);
  });
});
