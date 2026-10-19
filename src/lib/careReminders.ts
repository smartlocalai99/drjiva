import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { MyCare } from './care';
import { careDate, careText, type CareCopyKey } from './careCopy';
import { cycleDayOf, upcomingStepDays, type CareCycleStep } from './careCycle';
import { addDaysIso } from './careSchedule';
import { childDisplayName, childVisits, currentChildVisit } from './childGrowth';
import { loadExpoNotifications } from './expoNotifications';
import type { AppLanguage } from './i18n';
import { toIndianE164 } from './phone';
import { supabase } from './supabase';

// Follow-up visit reminders: 8 PM the day before, 8 AM on the day.
//
// How it stays reliable:
//  1. The two reminders are always set on the phone whenever the app
//     opens (works offline and without Apple / Google push keys).
//  2. If this phone can get an Expo push token, it is saved in the
//     database and a database job (pg_cron, 8 PM + 8 AM India time)
//     pushes the reminder only to phones that have not opened the app
//     since the nurse saved the date — the case the phone cannot know.
// A phone gets one or the other, so there are no duplicates.
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

// Child vaccines (Child Growth Chart): at 9 AM 3 days before, 1 day before
// and on the due date of each child's next open visit, and once "overdue"
// 7 days after it. At most CHILD_REMINDER_SLOTS at a time (phones keep a
// limited number of scheduled alerts; the medicine reminders need room
// too), soonest first.
export const CHILD_REMINDER_SLOTS = 12;
export const CARE_CHILD_REMINDER_IDS = Array.from({ length: CHILD_REMINDER_SLOTS }, (_, index) => `drjiva-care-child-${index}`);

export type ChildReminder = { at: Date; title: string; body: string; planId: string };

// Phone-local time on a 'YYYY-MM-DD' date.
const at = (date: string, hour: number) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hour, 0, 0, 0);
};

export function childReminders(care: MyCare, language: AppLanguage, now: Date): ChildReminder[] {
  const today = care.today;
  const followupDate = care.followup?.nextDate ?? null;
  const pick = (en: string, te: string) => (language === 'te' && te ? te : en);
  const out: ChildReminder[] = [];

  for (const plan of care.plans ?? []) {
    if (plan.type !== 'child' || plan.status !== 'active' || !today) continue;
    const records = (care.vaccineRecords ?? []).filter((record) => record.planId === plan.id);
    const visits = childVisits(plan, records, today);
    const auto = currentChildVisit(visits);
    const name = childDisplayName(plan.personName, careText(language, 'childNoName'));
    const hospital = plan.hospitalName;

    const add = (date: string, titleKey: CareCopyKey, body: string, hour = 8) => {
      const when = at(date, hour);
      if (when.getTime() > now.getTime()) out.push({ at: when, body, planId: plan.id, title: careText(language, titleKey, { name }) });
    };

    for (const visit of auto ? [auto] : []) {
      if (visit.status === 'completed') continue;
      const age = pick(visit.visit.titleEn, visit.visit.titleTe);
      const vaccines = visit.doses
        .filter((dose) => dose.kind !== 'optional' && !dose.given && !dose.notNeeded)
        .map((dose) => pick(dose.item.labelEn, dose.item.labelTe))
        .join(', ');
      const body = careText(language, 'vaxReminderBody', { age, hospital, vaccines });
      add(addDaysIso(visit.dueDate, -3), 'vaxReminder3Title', body);
      // The hospital visit reminder already covers the day before and the day.
      if (visit.dueDate !== followupDate) {
        add(addDaysIso(visit.dueDate, -1), 'vaxReminder1Title', body, 20);
        add(visit.dueDate, 'vaxReminder0Title', body);
      }
      add(addDaysIso(visit.dueDate, 7), 'vaxOverdueTitle', careText(language, 'vaxOverdueBody', { age, date: careDate(language, visit.dueDate), hospital }));
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, CHILD_REMINDER_SLOTS);
}

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
  const eve = new Date(y, m - 1, d - 1, 20, 0, 0, 0);
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
  const vaccines = childReminders(care, language, new Date());

  let granted = (await notifications.getPermissionsAsync()).granted;
  if (!granted && options.askPermission && (care.followup || cycleDays.length || vaccines.length)) {
    granted = (await notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return;

  // Lets the server remind phones that have not opened the app since the
  // nurse set the date. Phones that have, set their own alarms below.
  await registerPushToken(notifications, phone, language);

  // Clear only our own reminders, then set them again if needed.
  await Promise.allSettled([
    ...[CARE_REMINDER_IDS, ...CARE_CYCLE_REMINDER_IDS].flatMap((ids) => [
      notifications.cancelScheduledNotificationAsync(ids.eve),
      notifications.cancelScheduledNotificationAsync(ids.day),
    ]),
    ...CARE_CHILD_REMINDER_IDS.map((id) => notifications.cancelScheduledNotificationAsync(id)),
  ]);

  const now = new Date();
  // badge: the number on the app icon (1 the night before, 2 on the day);
  // opening My Care clears it.
  const schedule = (identifier: string, date: Date, title: string, body: string, data: Record<string, string | undefined>, badge = 1) =>
    notifications.scheduleNotificationAsync({
      content: {
        badge,
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
    if (times.day) await schedule(ids.day, times.day, careText(language, 'cycleReminderDayTitle', { steps: group.steps }), body, data, 2);
  }

  for (const [index, reminder] of vaccines.entries()) {
    const id = CARE_CHILD_REMINDER_IDS[index];
    if (!id) break;
    await schedule(id, reminder.at, reminder.title, reminder.body, { planId: reminder.planId, type: 'care_child_vaccine' });
  }

  // Always on the phone itself: works offline and without Apple / Google
  // push keys (iPhone push had none, so visit reminders never arrived).
  if (!care.followup) return;

  const hospital = care.followup.hospital.name;
  const data = { followupId: care.followup.id, type: 'care_followup' };
  const { day, eve } = followupReminderTimes(care.followup.nextDate, now);
  if (eve) {
    await schedule(CARE_REMINDER_IDS.eve, eve, careText(language, 'reminderEveTitle'), careText(language, 'reminderEveBody', { hospital }), data);
  }
  if (day) {
    await schedule(CARE_REMINDER_IDS.day, day, careText(language, 'reminderDayTitle'), careText(language, 'reminderDayBody', { hospital }), data, 2);
  }
}

const CARE_NOTIFICATION_TYPES = new Set(['care_followup', 'care_cycle', 'care_child_vaccine']);

// The patient opened My Care: clear the number on the app icon, remove the
// visit reminders already shown, and tell the server (push badge count).
export async function clearCareReminderBadge(): Promise<void> {
  const notifications = await loadExpoNotifications();
  if (notifications) {
    await notifications.setBadgeCountAsync(0).catch(() => false);
    const shown = await notifications.getPresentedNotificationsAsync().catch(() => []);
    await Promise.allSettled(
      shown
        .filter((item) => CARE_NOTIFICATION_TYPES.has(String(item.request.content.data?.type ?? '')))
        .map((item) => notifications.dismissNotificationAsync(item.request.identifier)),
    );
  }
  await supabase.rpc('care_mark_reminders_seen');
}
