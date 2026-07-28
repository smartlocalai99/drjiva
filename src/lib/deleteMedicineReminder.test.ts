import { describe, expect, it, vi } from 'vitest';

import { deleteMedicineReminderWithAdapter } from './deleteMedicineReminder';

describe('deleteMedicineReminderWithAdapter', () => {
  it('deletes the course before cancelling its unique phone alerts', async () => {
    const calls: string[] = [];
    const adapter = {
      cancelNotifications: vi.fn(async (ids: readonly string[]) => {
        calls.push(`cancel:${ids.join(',')}`);
      }),
      deleteCourse: vi.fn(async () => {
        calls.push('delete');
      }),
      listNotificationIds: vi.fn(async () => ['one', null, 'one', 'two']),
      queueCancellations: vi.fn(async () => undefined),
    };

    await deleteMedicineReminderWithAdapter(adapter, 'course-1');

    expect(calls).toEqual(['delete', 'cancel:one,two']);
    expect(adapter.queueCancellations).not.toHaveBeenCalled();
  });

  it('queues alert cleanup if cancellation is temporarily unavailable', async () => {
    const adapter = {
      cancelNotifications: vi.fn(async () => {
        throw new Error('unavailable');
      }),
      deleteCourse: vi.fn(async () => undefined),
      listNotificationIds: vi.fn(async () => ['one']),
      queueCancellations: vi.fn(async () => undefined),
    };

    await expect(
      deleteMedicineReminderWithAdapter(adapter, 'course-1'),
    ).resolves.toBeUndefined();
    expect(adapter.queueCancellations).toHaveBeenCalledWith(['one']);
  });

  it('keeps the course when notification lookup fails', async () => {
    const adapter = {
      cancelNotifications: vi.fn(async () => undefined),
      deleteCourse: vi.fn(async () => undefined),
      listNotificationIds: vi.fn(async () => {
        throw new Error('lookup failed');
      }),
      queueCancellations: vi.fn(async () => undefined),
    };

    await expect(
      deleteMedicineReminderWithAdapter(adapter, 'course-1'),
    ).rejects.toThrow('lookup failed');
    expect(adapter.deleteCourse).not.toHaveBeenCalled();
  });
});
