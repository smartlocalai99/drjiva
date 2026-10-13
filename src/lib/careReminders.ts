import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { MyCare } from './care';
import { careText } from './careCopy';
import { loadExpoNotifications } from './expoNotifications';
import type { AppLanguage } from './i18n';
import { toIndianE164 } from './phone';
import { supabase } from './supabase';

// Follow-up visit reminders: 6 PM the day before, 8 AM on the day.
//
// How it stays reliable:
//  1. If this phone can get an Expo push token, it is saved in the
//     database and a database job (pg_cron, 6 PM + 8 AM India time)
//     pushes the reminder — this works even if the nurse saved the date
//     after the patient last opened the app.
//  2. If not (e.g. Android builds without Firebase), the two reminders
//     are set on the phone whenever the app opens.
// Never both, so there are no duplicates.
//
// Kept apart from medicine reminders: own Android channel, normal sound
// (not the medicine voice), two fixed IDs, and no eventId in the data —
// medicine code only cancels its own IDs, and this code only cancels
// these two.
export const CARE_FOLLOWUP_CHANNEL = 'care-followups';
export const CARE_REMINDER_IDS = { day: 'drjiva-care-followup-day', eve: 'drjiva-care-followup-eve' } as const;

type Notifications = NonNullable<Awaited<ReturnType<typeof loadExpoNotifications>>>;

// Phone-local times for a follow-up date 'YYYY-MM-DD'; null if already past.
export function followupReminderTimes(nextDate: string, now: Date): { day: Date | null; eve: Date | null } {
  const [y, m, d] = nextDate.split('-').map(Number) as [number, number, number];
  const eve = new Date(y, m - 1, d - 1, 18, 0, 0, 0);
  const day = new Date(y, m - 1, d, 8, 0, 0, 0);
  return {
    day: day.getTime() > now.getTime() ? day : null,
    eve: eve.getTime() > now.getTime() ? eve : null,
  };
}

async function ensureCareFollowupChannel(notifications: Notifications): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifications.setNotificationChannelAsync(CARE_FOLLOWUP_CHANNEL, {
    description: 'Reminders for your next hospital follow-up visit',
    enableVibrate: true,
    importance: notifications.AndroidImportance.HIGH,
    name: 'Hospital visit reminders',
    showBadge: true,
    sound: 'default',
  });
}

async function registerPushToken(notifications: Notifications, phone: string, language: AppLanguage): Promise<boolean> {
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = await notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const { error } = await supabase.rpc('care_register_push_token', {
      p_language: language,
      p_mobile: toIndianE164(phone),
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
      p_token: token.data,
    });
    return !error;
  } catch {
    // No push credentials in this build, offline, or no permission.
    return false;
  }
}

export async function syncCareReminders(
  phone: string,
  care: MyCare,
  language: AppLanguage,
  options: { askPermission?: boolean } = {},
): Promise<void> {
  if (!care.linked) return;
  const notifications = await loadExpoNotifications();
  if (!notifications) return;

  // Channel first: Android 13+ needs it before a token / permission prompt.
  await ensureCareFollowupChannel(notifications);

  let granted = (await notifications.getPermissionsAsync()).granted;
  if (!granted && options.askPermission && care.followup) {
    granted = (await notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return;

  const serverPush = await registerPushToken(notifications, phone, language);

  // Clear only our own two reminders, then set them again if needed.
  await Promise.allSettled([
    notifications.cancelScheduledNotificationAsync(CARE_REMINDER_IDS.eve),
    notifications.cancelScheduledNotificationAsync(CARE_REMINDER_IDS.day),
  ]);
  if (serverPush || !care.followup) return;

  const hospital = care.followup.hospital.name;
  const { day, eve } = followupReminderTimes(care.followup.nextDate, new Date());
  const schedule = (identifier: string, date: Date, title: string, body: string) =>
    notifications.scheduleNotificationAsync({
      content: {
        body,
        data: { followupId: care.followup?.id, type: 'care_followup' },
        sound: 'default',
        title,
      },
      identifier,
      trigger: {
        channelId: CARE_FOLLOWUP_CHANNEL,
        date,
        type: notifications.SchedulableTriggerInputTypes.DATE,
      },
    });

  if (eve) {
    await schedule(CARE_REMINDER_IDS.eve, eve, careText(language, 'reminderEveTitle'), careText(language, 'reminderEveBody', { hospital }));
  }
  if (day) {
    await schedule(CARE_REMINDER_IDS.day, day, careText(language, 'reminderDayTitle'), careText(language, 'reminderDayBody', { hospital }));
  }
}
