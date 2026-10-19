import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  from,
  listScheduledDoseEventIds,
  migrationStorage,
  requestMedicineNotificationPermission,
  rpc,
  scheduleGroupedDoseNotifications,
} = vi.hoisted(() => ({
  from: vi.fn(),
  listScheduledDoseEventIds: vi.fn(async () => new Set<string>()),
  migrationStorage: new Map<string, string>(),
  requestMedicineNotificationPermission: vi.fn(async () => true),
  rpc: vi.fn(),
  scheduleGroupedDoseNotifications: vi.fn(),
}));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: vi.fn(async () => 'owner-1'),
}));
vi.mock('./supabase', () => ({ supabase: { from, rpc } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => migrationStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      migrationStorage.set(key, value);
    },
  },
}));
vi.mock('./medicineNotifications', async (importOriginal) => ({
  cancelDoseNotifications: vi.fn(async () => undefined),
  cancelScheduledDoseNotificationsForEvents: vi.fn(async () => undefined),
  listScheduledDoseEventIds,
  queueNotificationCancellations: vi.fn(async () => undefined),
  requestMedicineNotificationPermission,
  scheduleGroupedDoseNotifications,
  upcomingAlertEventIds: (await importOriginal<typeof import('./medicineNotifications')>()).upcomingAlertEventIds,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock('./expoNotifications', () => ({ requireExpoNotifications: vi.fn() }));

import { replenishOngoingMedicineCourses } from './ongoingMedicineCoordinator';

const migrationKey =
  'drjiva.groupedMedicineNotifications.v5-one-alert-per-time.owner-1';

describe('grouped reminder cleanup migration', () => {
  const savedNotificationIds = new Map<string, string>();

  beforeEach(() => {
    vi.clearAllMocks();
    migrationStorage.clear();
    savedNotificationIds.clear();
    requestMedicineNotificationPermission.mockResolvedValue(true);
    listScheduledDoseEventIds.mockResolvedValue(new Set<string>());
    scheduleGroupedDoseNotifications.mockResolvedValue([
      { eventId: 'event-1', notificationId: 'grouped-reminder-1' },
    ]);
    // Alert IDs are saved with one database call.
    rpc.mockImplementation(async (name: string, args: { p_event_ids: string[]; p_notification_ids: string[] }) => {
      if (name !== 'save_dose_notification_ids') throw new Error(`Unexpected rpc: ${name}`);
      args.p_event_ids.forEach((eventId, index) => savedNotificationIds.set(eventId, args.p_notification_ids[index]!));
      return { data: args.p_event_ids.length, error: null };
    });
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
      };
    });
  });

  it.each(['v2', 'v3-ios-sound', 'v4-grouped-reminder-cleanup'])(
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

  it('on app open, sets alarms for doses that have none on this phone', async () => {
    migrationStorage.set(migrationKey, 'true');
    listScheduledDoseEventIds.mockResolvedValue(new Set<string>());

    await replenishOngoingMedicineCourses(14, { checkDeviceAlarms: true });

    expect(scheduleGroupedDoseNotifications).toHaveBeenCalledOnce();
    expect(savedNotificationIds.get('event-1')).toBe('grouped-reminder-1');
  });

  it('on app open, leaves alarms alone when the phone already has them', async () => {
    migrationStorage.set(migrationKey, 'true');
    listScheduledDoseEventIds.mockResolvedValue(new Set(['event-1']));

    await replenishOngoingMedicineCourses(14, { checkDeviceAlarms: true });

    expect(scheduleGroupedDoseNotifications).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not check the phone when notifications are off', async () => {
    migrationStorage.set(migrationKey, 'true');
    requestMedicineNotificationPermission.mockResolvedValue(false);

    await replenishOngoingMedicineCourses(14, { checkDeviceAlarms: true });

    expect(listScheduledDoseEventIds).not.toHaveBeenCalled();
    expect(scheduleGroupedDoseNotifications).not.toHaveBeenCalled();
  });
});
