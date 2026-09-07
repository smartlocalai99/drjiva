import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FutureDoseReminder } from './medicineCourses';

type PendingNotification = {
  identifier: string;
  content: {
    body?: string;
    data: Record<string, unknown>;
    title?: string;
  };
  trigger?: { date: Date };
};

const {
  fetchScheduledDoseRemindersFromToday,
  requireExpoNotifications,
  saveNotificationIds,
  storage,
} = vi.hoisted(() => ({
  fetchScheduledDoseRemindersFromToday: vi.fn(),
  requireExpoNotifications: vi.fn(),
  saveNotificationIds: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        medicineReminderChannel: 'medicine-reminders-loud-v3',
        medicineReminderSoundAndroid: 'rec',
      },
    },
  },
}));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    removeItem: async (key: string) => { storage.delete(key); },
    setItem: async (key: string, value: string) => { storage.set(key, value); },
  },
}));
vi.mock('./expoNotifications', () => ({ requireExpoNotifications }));
vi.mock('./medicineCourses', () => ({
  fetchScheduledDoseRemindersFromToday,
  saveNotificationIds,
}));

// Keep both reconciliation and notification construction real. Only the
// database and native operating-system notification inventory are replaced.
import {
  syncDoseNotifications,
  syncPatientDoseNotifications,
} from './medicineNotificationSync';

const pending = new Map<string, PendingNotification>();
const database = new Map<string, FutureDoseReminder>();
const morning = '2026-09-08T02:30:00.000Z';

function sixMedicines(
  scheduledFor = morning,
  slot: FutureDoseReminder['slot'] = 'morning',
  prefix = 'morning',
): FutureDoseReminder[] {
  return Array.from({ length: 6 }, (_, index) => ({
    eventId: `${prefix}-${index + 1}`,
    medicineName: `Medicine ${index + 1}`,
    notificationId: `stored-${prefix}-${index + 1}`,
    scheduledFor,
    slot,
    tablets: 1,
  }));
}

function seedLegacyAlerts(reminders: readonly FutureDoseReminder[]): void {
  for (const reminder of reminders) {
    database.set(reminder.eventId, { ...reminder });
    // An older sync can leave an alert whose native identifier was never
    // saved, or was overwritten by a different device's database update.
    for (const identifier of [reminder.notificationId!, `orphan-${reminder.eventId}`]) {
      pending.set(identifier, {
        identifier,
        content: { data: { eventId: reminder.eventId, route: '/home' } },
      });
    }
  }
}

function medicineAlerts(): PendingNotification[] {
  return [...pending.values()].filter((request) => request.content.data.route === '/home');
}

describe('medicine notification reconciliation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-07T00:00:00.000Z'));
    pending.clear();
    database.clear();
    storage.clear();
    let nextIdentifier = 0;

    requireExpoNotifications.mockResolvedValue({
      AndroidAudioContentType: { SPEECH: 'speech' },
      AndroidAudioUsage: { ALARM: 'alarm' },
      AndroidImportance: { MAX: 5 },
      SchedulableTriggerInputTypes: { DATE: 'date' },
      cancelScheduledNotificationAsync: async (identifier: string) => {
        pending.delete(identifier);
      },
      getAllScheduledNotificationsAsync: async () => [...pending.values()],
      scheduleNotificationAsync: async (request: Omit<PendingNotification, 'identifier'>) => {
        const identifier = `new-alert-${++nextIdentifier}`;
        pending.set(identifier, { ...request, identifier });
        return identifier;
      },
      setNotificationChannelAsync: async () => undefined,
    });
    fetchScheduledDoseRemindersFromToday.mockImplementation(async () =>
      [...database.values()].map((reminder) => ({ ...reminder })),
    );
    saveNotificationIds.mockImplementation(async (
      identifiers: Array<{ eventId: string; notificationId: string }>,
    ) => {
      for (const item of identifiers) {
        database.set(item.eventId, {
          ...database.get(item.eventId)!,
          notificationId: item.notificationId,
        });
      }
    });
  });

  afterEach(() => { vi.useRealTimers(); });

  it('replaces six stored and orphaned medicine alerts with one complete reminder', async () => {
    const reminders = sixMedicines();
    seedLegacyAlerts(reminders);
    const receipt = {
      identifier: 'order-receipt',
      content: { data: { orderId: 'order-1', route: '/orders' } },
    };
    pending.set(receipt.identifier, receipt);

    await syncPatientDoseNotifications('patient-1');

    expect(medicineAlerts()).toHaveLength(1);
    expect(pending.size).toBe(2);
    expect(pending.get('order-receipt')).toEqual(receipt);
    const alert = medicineAlerts()[0]!;
    expect(alert.content.data.eventIds).toEqual([
      'morning-1', 'morning-2', 'morning-3',
      'morning-4', 'morning-5', 'morning-6',
    ]);
    for (const reminder of reminders) {
      expect(alert.content.body).toContain(reminder.medicineName);
      expect(database.get(reminder.eventId)?.notificationId).toBe(alert.identifier);
    }
    expect(alert.trigger?.date.toISOString()).toBe(morning);
  });

  it('keeps one pending alert through concurrent and repeated syncs with stale stored identifiers', async () => {
    const reminders = sixMedicines();
    seedLegacyAlerts(reminders);

    await Promise.all([
      syncDoseNotifications(reminders),
      syncDoseNotifications(reminders),
      syncDoseNotifications(reminders),
    ]);

    expect(medicineAlerts()).toHaveLength(1);
    expect(medicineAlerts()[0]!.content.data.eventIds).toHaveLength(6);

    await syncDoseNotifications(reminders);
    await syncPatientDoseNotifications('patient-1');

    expect(pending.size).toBe(1);
    expect(medicineAlerts()[0]!.content.data.eventIds).toHaveLength(6);
    expect(new Set([...database.values()].map((reminder) => reminder.notificationId)))
      .toEqual(new Set([medicineAlerts()[0]!.identifier]));
  });

  it('keeps morning, afternoon, night, and the next morning as four separate reminders', async () => {
    seedLegacyAlerts([
      ...sixMedicines(),
      ...sixMedicines('2026-09-08T07:30:00.000Z', 'afternoon', 'afternoon'),
      ...sixMedicines('2026-09-08T14:30:00.000Z', 'night', 'night'),
      ...sixMedicines('2026-09-09T02:30:00.000Z', 'morning', 'next-morning'),
    ]);

    await syncPatientDoseNotifications('patient-1');

    const alerts = medicineAlerts();
    expect(pending.size).toBe(4);
    expect(alerts.map((alert) => alert.trigger?.date.toISOString())).toEqual([
      '2026-09-08T02:30:00.000Z',
      '2026-09-08T07:30:00.000Z',
      '2026-09-08T14:30:00.000Z',
      '2026-09-09T02:30:00.000Z',
    ]);
    for (const [index, prefix] of ['morning', 'afternoon', 'night', 'next-morning'].entries()) {
      expect(alerts[index]!.content.data.eventIds).toEqual([
        `${prefix}-1`, `${prefix}-2`, `${prefix}-3`,
        `${prefix}-4`, `${prefix}-5`, `${prefix}-6`,
      ]);
    }
  });

  it('keeps phone reminders active when saving identifiers fails and reconciles the next sync', async () => {
    seedLegacyAlerts(sixMedicines());
    saveNotificationIds.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(syncPatientDoseNotifications('patient-1'))
      .rejects.toThrow('database unavailable');

    expect(medicineAlerts()).toHaveLength(1);
    expect(medicineAlerts()[0]!.content.data.eventIds).toHaveLength(6);
    expect(database.get('morning-1')?.notificationId).toBe('stored-morning-1');

    // The database still holds the identifiers from before the failed sync.
    // Native event metadata must find the active replacement on retry.
    await syncPatientDoseNotifications('patient-1');

    expect(pending.size).toBe(1);
    const alert = medicineAlerts()[0]!;
    expect(alert.content.data.eventIds).toHaveLength(6);
    expect(new Set([...database.values()].map((reminder) => reminder.notificationId)))
      .toEqual(new Set([alert.identifier]));
  });
});
