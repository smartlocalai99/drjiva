import {
  fetchScheduledDoseRemindersFromToday,
  saveNotificationIds,
  type FutureDoseReminder,
} from './medicineCourses';
import {
  cancelDoseNotifications,
  cancelScheduledDoseNotificationsForEvents,
  queueNotificationCancellations,
  scheduleGroupedDoseNotifications,
} from './medicineNotifications';

let notificationSyncQueue: Promise<void> = Promise.resolve();

async function performDoseNotificationSync(
  reminders: readonly FutureDoseReminder[],
): Promise<{ cleanupPending: boolean }> {
  const oldIds = reminders.flatMap((reminder) =>
    reminder.notificationId ? [reminder.notificationId] : [],
  );

  try {
    // Discover phone-side alarms before cancelling stored IDs so a failed
    // inventory read leaves the current reminders intact.
    await cancelScheduledDoseNotificationsForEvents(
      reminders.map((reminder) => reminder.eventId),
    );
    await cancelDoseNotifications(oldIds);
  } catch (error) {
    await queueNotificationCancellations(oldIds);
    throw error;
  }

  const identifiers = await scheduleGroupedDoseNotifications(
    reminders.map((reminder) => ({
      eventId: reminder.eventId,
      medicineName: reminder.medicineName,
      scheduledFor: reminder.scheduledFor,
      slot: reminder.slot,
      slotKey: reminder.slot,
      tablets: reminder.tablets,
    })),
  );
  // Keep the working alerts if saving IDs fails. A later sync discovers
  // them by event metadata, so retrying does not add duplicate reminders.
  await saveNotificationIds(identifiers);
  return { cleanupPending: false };
}

function enqueueDoseNotificationSync(
  loadReminders: () => Promise<readonly FutureDoseReminder[]>,
): Promise<{ cleanupPending: boolean }> {
  const sync = notificationSyncQueue.then(async () =>
    performDoseNotificationSync(await loadReminders()),
  );
  notificationSyncQueue = sync.then(
    () => undefined,
    () => undefined,
  );
  return sync;
}

export function syncDoseNotifications(
  reminders: readonly FutureDoseReminder[],
): Promise<{ cleanupPending: boolean }> {
  return enqueueDoseNotificationSync(async () => reminders);
}

export function syncPatientDoseNotifications(
  patientId: string,
): Promise<{ cleanupPending: boolean }> {
  // Fetch inside the queue so an overlapping app resume or medicine save
  // cannot replace newer alarms with a snapshot loaded before the last sync.
  return enqueueDoseNotificationSync(
    () => fetchScheduledDoseRemindersFromToday(patientId),
  );
}
