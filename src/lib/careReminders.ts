import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { MyCare } from './care';
import { careText, type CareCopyKey } from './careCopy';
import { cycleDayOf, upcomingStepDays, type CareCycleStep } from './careCycle';
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
//
// Fertility cycle steps (OI-TI / IUI) get the same two reminders for the
// next CYCLE_REMINDER_DAYS hospital days. They are always set on the
// phone (the server job only knows follow-up dates), with their own fixed
// IDs, and skip the follow-up date so a day never gets two reminders.
export const CARE_FOLLOWUP_CHANNEL = 'care-followups';
export const CARE_REMINDER_IDS = { day: 'drjiva-care-followup-day', eve: 'drjiva-care-followup-eve' } as const;
export const CYCLE_REMINDER_DAYS = 3;
export const CARE_CYCLE_REMINDER_IDS = Array.from({ length: CYCLE_REMINDER_DAYS }, (_, index) => ({
  day: `drjiva-care-cycle-day-${index}`,
  eve: `drjiva-care-cycle-eve-${index}`,
}));

const WHO_KEYS: Record<CareCycleStep['who'], CareCopyKey | null> = { couple: 'whoCouple', husband: 'whoHusband', wife: null };

export type CycleReminderDay = { date: string; day: number; hospital: string; steps: string };

// The next hospital days of every active cycle, in words, without the
// follow-up date (that one already has its reminders).
export function cycleReminderDays(care: MyCare, language: AppLanguage, today: string): CycleReminderDay[] {
  const skip = care.followup?.nextDate ?? null;
  return (care.cycles ?? [])
    .flatMap((cycle) =>
      upcomingStepDays(cycle, today, CYCLE_REMINDER_DAYS + 1).map((group) => ({
        date: group.date,
        day: cycleDayOf(cycle, group.date),
        hospital: cycle.hospitalName,
        steps: group.steps
          .map((step) => {
            const label = language === 'te' && step.labelTe ? step.labelTe : step.labelEn;
            const who = WHO_KEYS[step.who];
            return who ? `${label} (${careText(language, who)})` : label;
          })
          .join(', '),
      })),
    )
    .filter((group) => group.date !== skip)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .slice(0, CYCLE_REMINDER_DAYS);
}

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

  const cycleDays = care.today ? cycleReminderDays(care, language, care.today) : [];

  let granted = (await notifications.getPermissionsAsync()).granted;
  if (!granted && options.askPermission && (care.followup || cycleDays.length)) {
    granted = (await notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return;

  const serverPush = await registerPushToken(notifications, phone, language);

  // Clear only our own reminders, then set them again if needed.
  await Promise.allSettled(
    [CARE_REMINDER_IDS, ...CARE_CYCLE_REMINDER_IDS].flatMap((ids) => [
      notifications.cancelScheduledNotificationAsync(ids.eve),
      notifications.cancelScheduledNotificationAsync(ids.day),
    ]),
  );

  const now = new Date();
  const schedule = (identifier: string, date: Date, title: string, body: string, data: Record<string, string | undefined>) =>
    notifications.scheduleNotificationAsync({
      content: {
        body,
        data,
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

  for (const [index, group] of cycleDays.entries()) {
    const ids = CARE_CYCLE_REMINDER_IDS[index];
    if (!ids) break;
    const times = followupReminderTimes(group.date, now);
    const body = careText(language, 'cycleReminderBody', { hospital: group.hospital, n: group.day });
    const data = { date: group.date, type: 'care_cycle' };
    if (times.eve) await schedule(ids.eve, times.eve, careText(language, 'cycleReminderEveTitle', { steps: group.steps }), body, data);
    if (times.day) await schedule(ids.day, times.day, careText(language, 'cycleReminderDayTitle', { steps: group.steps }), body, data);
  }

  if (serverPush || !care.followup) return;

  const hospital = care.followup.hospital.name;
  const data = { followupId: care.followup.id, type: 'care_followup' };
  const { day, eve } = followupReminderTimes(care.followup.nextDate, now);
  if (eve) {
    await schedule(CARE_REMINDER_IDS.eve, eve, careText(language, 'reminderEveTitle'), careText(language, 'reminderEveBody', { hospital }), data);
  }
  if (day) {
    await schedule(CARE_REMINDER_IDS.day, day, careText(language, 'reminderDayTitle'), careText(language, 'reminderDayBody', { hospital }), data);
  }
}
