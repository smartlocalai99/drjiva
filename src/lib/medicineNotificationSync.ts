import {
  fetchDeviceDoseRemindersFromToday,
  saveNotificationIds,
  type FutureDoseReminder,
} from './medicineCourses';
import {
  cancelDoseNotifications,
  cancelScheduledDoseNotificationsForEvents,
  listScheduledDoseEventIds,
  queueNotificationCancellations,
  scheduleGroupedDoseNotifications,
  upcomingAlertEventIds,
} from './medicineNotifications';

// The next alert times (about a week of doses) this phone must already have
// when the app opens. Fewer than the alerts a rebuild sets, so the check
// passes for days after each rebuild.
export const DEVICE_ALARM_CHECK_COUNT = 20;

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

// One alarm job at a time, so an app resume, a medicine save and the
// app-open check never rebuild from different snapshots at once.
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = notificationSyncQueue.then(task);
  notificationSyncQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function enqueueDoseNotificationSync(
  loadReminders: () => Promise<readonly FutureDoseReminder[]>,
): Promise<{ cleanupPending: boolean }> {
  return enqueue(async () => performDoseNotificationSync(await loadReminders()));
}

export function syncDoseNotifications(
  reminders: readonly FutureDoseReminder[],
): Promise<{ cleanupPending: boolean }> {
  return enqueueDoseNotificationSync(async () => reminders);
}

// Called after a patient's medicines change. Rebuilds the alarms of every
// patient on this phone together, so one time rings once, however many
// medicines or people are due then.
export function syncPatientDoseNotifications(
  _patientId: string,
): Promise<{ cleanupPending: boolean }> {
  // Fetch inside the queue so an overlapping app resume or medicine save
  // cannot replace newer alarms with a snapshot loaded before the last sync.
  return enqueueDoseNotificationSync(fetchDeviceDoseRemindersFromToday);
}

// A phone sets alarms only when something changes on that same phone, so
// medicines added or billed from another phone (or the hospital) never rang
// here, and iPhones drop alerts beyond their limit. On app open: one read of
// this phone's upcoming doses, compared with the alarms waiting on the phone;
// rebuild only if some are missing.
export function ensureDeviceDoseAlarms(): Promise<'ok' | 'rebuilt'> {
  return enqueue(async () => {
    const reminders = await fetchDeviceDoseRemindersFromToday();
    const expected = upcomingAlertEventIds(reminders, DEVICE_ALARM_CHECK_COUNT);
    if (expected.length === 0) return 'ok';
    const onPhone = await listScheduledDoseEventIds();
    if (expected.every((eventId) => onPhone.has(eventId))) return 'ok';
    await performDoseNotificationSync(reminders);
    return 'rebuilt';
  });
}
