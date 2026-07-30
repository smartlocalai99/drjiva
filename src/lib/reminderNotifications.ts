import notifee, {
  AuthorizationStatus,
  RepeatFrequency,
  TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const REMINDER_SOUND = 'reminder.caf';
const REMINDER_TITLE = 'Medicine Reminder';
const REMINDER_BODY = 'దయచేసి మీ మందులు వేసుకోండి';

function medicineReminderId(medicineName: string): string {
  const slug = medicineName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `medicine-reminder-${slug || 'medicine'}`;
}

/**
 * iOS only. Requests alert/sound/badge permission for local notifications.
 * Returns whether the app is authorized (including provisional) to show them.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }

  const settings = await notifee.requestPermission({
    alert: true,
    badge: true,
    sound: true,
  });

  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * iOS only. Schedules a local notification for `medicineName` at `date`,
 * playing the bundled reminder.caf sound. Scheduling again for the same
 * medicine replaces the previous reminder (same notification id), so this
 * also serves as the "update" path when a reminder time changes.
 */
export async function scheduleMedicineReminder(
  date: Date,
  medicineName: string,
): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw new Error('scheduleMedicineReminder is iOS only');
  }

  const id = medicineReminderId(medicineName);

  const trigger: TimestampTrigger = {
    timestamp: date.getTime(),
    type: TriggerType.TIMESTAMP,
  };

  return notifee.createTriggerNotification(
    {
      body: REMINDER_BODY,
      id,
      ios: { sound: REMINDER_SOUND },
      title: REMINDER_TITLE,
    },
    trigger,
  );
}

/**
 * iOS only. Schedules a daily-repeating version of the same reminder,
 * starting at `date` and firing again every day at that time.
 */
export async function scheduleDailyMedicineReminder(
  date: Date,
  medicineName: string,
): Promise<string> {
  if (Platform.OS !== 'ios') {
    throw new Error('scheduleDailyMedicineReminder is iOS only');
  }

  const id = medicineReminderId(medicineName);

  const trigger: TimestampTrigger = {
    repeatFrequency: RepeatFrequency.DAILY,
    timestamp: date.getTime(),
    type: TriggerType.TIMESTAMP,
  };

  return notifee.createTriggerNotification(
    {
      body: REMINDER_BODY,
      id,
      ios: { sound: REMINDER_SOUND },
      title: REMINDER_TITLE,
    },
    trigger,
  );
}

/**
 * iOS only. Cancels the scheduled reminder for `medicineName`, if any.
 */
export async function cancelMedicineReminder(
  medicineName: string,
): Promise<void> {
  await notifee.cancelTriggerNotification(medicineReminderId(medicineName));
}
