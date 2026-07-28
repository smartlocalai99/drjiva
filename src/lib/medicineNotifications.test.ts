import { describe, expect, it } from 'vitest';

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
