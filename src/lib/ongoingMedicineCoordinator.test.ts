import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  from,
  migrationStorage,
  requestMedicineNotificationPermission,
  scheduleGroupedDoseNotifications,
} = vi.hoisted(() => ({
  from: vi.fn(),
  migrationStorage: new Map<string, string>(),
  requestMedicineNotificationPermission: vi.fn(async () => true),
  scheduleGroupedDoseNotifications: vi.fn(),
}));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: vi.fn(async () => 'owner-1'),
}));
vi.mock('./supabase', () => ({ supabase: { from } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => migrationStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      migrationStorage.set(key, value);
    },
  },
}));
vi.mock('./medicineNotifications', () => ({
  cancelDoseNotifications: vi.fn(async () => undefined),
  cancelScheduledDoseNotificationsForEvents: vi.fn(async () => undefined),
  queueNotificationCancellations: vi.fn(async () => undefined),
  requestMedicineNotificationPermission,
  scheduleGroupedDoseNotifications,
}));

import { replenishOngoingMedicineCourses } from './ongoingMedicineCoordinator';

const migrationKey =
  'drjiva.groupedMedicineNotifications.v4-grouped-reminder-cleanup.owner-1';

describe('grouped reminder cleanup migration', () => {
  const savedNotificationIds = new Map<string, string>();

  beforeEach(() => {
    vi.clearAllMocks();
    migrationStorage.clear();
    savedNotificationIds.clear();
    requestMedicineNotificationPermission.mockResolvedValue(true);
    scheduleGroupedDoseNotifications.mockResolvedValue([
      { eventId: 'event-1', notificationId: 'grouped-reminder-1' },
    ]);
    from.mockImplementation((table: string) => {
      if (table === 'patient_medicine_courses') {
        const query = {
          select: () => query,
          eq: () => query,
          is: async () => ({ data: [], error: null }),
        };
        return query;
      }
      if (table !== 'patient_medicine_dose_events') {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select: (columns: string) => {
          const query = {
            eq: () => query,
            gte: () => query,
            gt: async () => ({
              data: [{ patient_id: 'patient-1' }, { patient_id: 'patient-1' }],
              error: null,
            }),
            order: async () => ({
              data: [{
                id: 'event-1',
                notification_id: 'legacy-reminder-1',
                patient_medicine_courses: {
                  medicines: { name: 'Dolo 650' },
                  patient_custom_medicines: null,
                  tablets_per_dose: 1,
                },
                scheduled_for: '2099-01-01T08:00:00.000Z',
                slot: 'morning',
              }],
              error: null,
            }),
          };
          if (columns !== 'patient_id' && !columns.includes('notification_id')) {
            throw new Error(`Unexpected selection: ${columns}`);
          }
          return query;
        },
        update: ({ notification_id }: { notification_id: string }) => ({
          eq: async (column: string, eventId: string) => {
            if (column !== 'id') throw new Error(`Unexpected filter: ${column}`);
            savedNotificationIds.set(eventId, notification_id);
            return { error: null };
          },
        }),
      };
    });
  });

  it.each(['v2', 'v3-ios-sound'])(
    'rebuilds existing reminders even when migration %s was already completed',
    async (previousVersion) => {
      migrationStorage.set(
        `drjiva.groupedMedicineNotifications.${previousVersion}.owner-1`,
        'true',
      );

      await replenishOngoingMedicineCourses();

      expect(savedNotificationIds.get('event-1')).toBe('grouped-reminder-1');
      expect(scheduleGroupedDoseNotifications).toHaveBeenCalledOnce();
      expect(migrationStorage.get(migrationKey)).toBe('true');
    },
  );

  it('skips rebuilding reminders after the cleanup migration has completed', async () => {
    migrationStorage.set(migrationKey, 'true');

    await replenishOngoingMedicineCourses();

    expect(savedNotificationIds.size).toBe(0);
    expect(scheduleGroupedDoseNotifications).not.toHaveBeenCalled();
  });

  it('retries cleanup after a failed sync without marking it completed early', async () => {
    scheduleGroupedDoseNotifications.mockRejectedValueOnce(
      new Error('Notifications are temporarily unavailable'),
    );

    await expect(replenishOngoingMedicineCourses()).rejects.toThrow(
      'Notifications are temporarily unavailable',
    );
    expect(migrationStorage.has(migrationKey)).toBe(false);
    expect(savedNotificationIds.size).toBe(0);

    await replenishOngoingMedicineCourses();

    expect(savedNotificationIds.get('event-1')).toBe('grouped-reminder-1');
    expect(migrationStorage.get(migrationKey)).toBe('true');
  });
});
