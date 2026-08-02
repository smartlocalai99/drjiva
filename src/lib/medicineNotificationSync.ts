import {
  fetchScheduledDoseRemindersFromToday,
  saveNotificationIds,
  type FutureDoseReminder,
} from './medicineCourses';
import {
  cancelDoseNotifications,
  queueNotificationCancellations,
  scheduleGroupedDoseNotifications,
} from './medicineNotifications';

export async function syncDoseNotifications(
  reminders: readonly FutureDoseReminder[],
): Promise<{ cleanupPending: boolean }> {
  const oldIds = reminders.flatMap((reminder) =>
    reminder.notificationId ? [reminder.notificationId] : [],
  );
  let cleanupPending = false;

  try {
    await cancelDoseNotifications(oldIds);
  } catch {
    await queueNotificationCancellations(oldIds);
    cleanupPending = true;
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
  await saveNotificationIds(identifiers);
  return { cleanupPending };
}

export async function syncPatientDoseNotifications(
  patientId: string,
): Promise<{ cleanupPending: boolean }> {
  return syncDoseNotifications(
    await fetchScheduledDoseRemindersFromToday(patientId),
  );
}
