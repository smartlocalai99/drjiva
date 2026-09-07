import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  cancelDoseNotifications,
  cancelScheduledDoseNotificationsForEvents,
  fetchScheduledDoseRemindersFromToday,
  queueNotificationCancellations,
  saveNotificationIds,
  scheduleGroupedDoseNotifications,
} = vi.hoisted(() => ({
  cancelDoseNotifications: vi.fn(async () => undefined),
  cancelScheduledDoseNotificationsForEvents: vi.fn(async () => undefined),
  fetchScheduledDoseRemindersFromToday: vi.fn(),
  queueNotificationCancellations: vi.fn(async () => undefined),
  saveNotificationIds: vi.fn(async () => undefined),
  scheduleGroupedDoseNotifications: vi.fn(),
}));

vi.mock('./medicineCourses', () => ({
  fetchScheduledDoseRemindersFromToday,
  saveNotificationIds,
}));
vi.mock('./medicineNotifications', () => ({
  cancelDoseNotifications,
  cancelScheduledDoseNotificationsForEvents,
  queueNotificationCancellations,
  scheduleGroupedDoseNotifications,
}));

import { syncDoseNotifications, syncPatientDoseNotifications } from './medicineNotificationSync';

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
    fetchScheduledDoseRemindersFromToday.mockResolvedValue([reminder]);
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
    fetchScheduledDoseRemindersFromToday.mockImplementation(async () => {
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
