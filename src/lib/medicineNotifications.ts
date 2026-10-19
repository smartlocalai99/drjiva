import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { DOSE_SLOT_THEME } from './doseSlotTheme';
import { requireExpoNotifications } from './expoNotifications';
import type { DoseSlot } from './medicineSchedule';
import { formatScheduledTime12Hour } from './medicineTime';

type NotificationEvent = {
  eventId: string;
  scheduledFor: string;
};

type ScheduledNotificationRequest = {
  content: {
    data?: Record<string, unknown> | null;
  };
  identifier: string;
};

type NotificationContent = {
  medicineName: string;
  slot: string;
  slotKey: DoseSlot;
  tablets: number;
};

export type DoseNotificationRequest = NotificationEvent & NotificationContent;

type DoseNotificationGroup = {
  reminders: DoseNotificationRequest[];
  scheduledFor: string;
};

type NotificationAdapter = {
  cancel: (identifier: string) => Promise<void>;
  schedule: (
    event: NotificationEvent,
    content: NotificationContent,
  ) => Promise<string>;
};

type GroupedNotificationAdapter = {
  cancel: (identifier: string) => Promise<void>;
  schedule: (group: DoseNotificationGroup) => Promise<string>;
};

const PENDING_CANCELLATIONS_KEY = 'drjiva.pendingNotificationCancellations';
const NOTIFICATION_NUDGE_SHOWN_KEY = 'drjiva.notificationSettingsNudgeShown';
const DEFAULT_REMINDER_CHANNEL = 'medicine-reminders';

// iPhones keep only the 64 soonest waiting notifications per app and
// silently drop the rest. Medicine alerts take the free room (about three
// weeks for most patients), leaving space for the visit and vaccine
// reminders already waiting plus a small margin, and never fewer than 30.
// The app-open check (ensureDeviceDoseAlarms) sets the next ones as these
// ring.
const IOS_WAITING_LIMIT = 64;
const IOS_MARGIN = 4;
export const MIN_MEDICINE_ALERTS_IOS = 30;
export const MAX_MEDICINE_ALERTS_ANDROID = 150;

// Call after this sync's own medicine alerts were cancelled: what is still
// waiting belongs to other reminders.
async function maxMedicineAlerts(
  Notifications: Awaited<ReturnType<typeof requireExpoNotifications>>,
): Promise<number> {
  if (Platform.OS !== 'ios') return MAX_MEDICINE_ALERTS_ANDROID;
  const waiting = await Notifications.getAllScheduledNotificationsAsync();
  return Math.max(
    MIN_MEDICINE_ALERTS_IOS,
    IOS_WAITING_LIMIT - IOS_MARGIN - waiting.length,
  );
}

function getMedicineReminderSoundConfig(): {
  channelId: string;
  sound: 'default' | string;
} {
  const channelId =
    Constants.expoConfig?.extra?.medicineReminderChannel;
  const sound =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.extra?.medicineReminderSoundIOS
      : Constants.expoConfig?.extra?.medicineReminderSoundAndroid;
  return {
    channelId:
      typeof channelId === 'string' && channelId
        ? channelId
        : DEFAULT_REMINDER_CHANNEL,
    sound: typeof sound === 'string' && sound ? sound : 'default',
  };
}

async function ensureMedicineReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  const Notifications = await requireExpoNotifications();
  const { channelId, sound } = getMedicineReminderSoundConfig();
  await Notifications.setNotificationChannelAsync(channelId, {
    audioAttributes: {
      contentType: Notifications.AndroidAudioContentType.SPEECH,
      flags: {
        enforceAudibility: true,
        requestHardwareAudioVideoSynchronization: false,
      },
      usage: Notifications.AndroidAudioUsage.ALARM,
    },
    description: 'Spoken alerts for scheduled medicine doses',
    enableLights: true,
    enableVibrate: true,
    importance: Notifications.AndroidImportance.MAX,
    lightColor: '#2A6BA5',
    name: 'Medicine reminders',
    showBadge: true,
    sound,
    vibrationPattern: [0, 500, 200, 500, 200, 750],
  });
}

export async function scheduleDoseNotificationsWithAdapter(
  adapter: NotificationAdapter,
  events: readonly NotificationEvent[],
  content: NotificationContent,
): Promise<Array<{ eventId: string; notificationId: string }>> {
  const scheduled: Array<{ eventId: string; notificationId: string }> = [];
  try {
    for (const event of events) {
      const notificationId = await adapter.schedule(event, content);
      scheduled.push({ eventId: event.eventId, notificationId });
    }
    return scheduled;
  } catch (error) {
    await Promise.allSettled(
      scheduled.map(({ notificationId }) => adapter.cancel(notificationId)),
    );
    throw error;
  }
}

// One alert (one sound) per minute: every medicine due in the same minute
// shares it, however many there are. It rings at the earliest of them.
export function groupDoseNotificationRequests<
  T extends { scheduledFor: string },
>(
  reminders: readonly T[],
): Array<{ reminders: T[]; scheduledFor: string }> {
  const groups = new Map<number, { reminders: T[]; scheduledFor: string }>();
  for (const reminder of reminders) {
    const timestamp = new Date(reminder.scheduledFor).getTime();
    if (!Number.isFinite(timestamp)) continue;
    const minute = Math.floor(timestamp / 60_000);
    const group = groups.get(minute);
    if (group) {
      group.reminders.push(reminder);
      if (timestamp < new Date(group.scheduledFor).getTime()) {
        group.scheduledFor = reminder.scheduledFor;
      }
    } else {
      groups.set(minute, {
        reminders: [reminder],
        scheduledFor: reminder.scheduledFor,
      });
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, group]) => group);
}

// The dose events a phone alert rings for (old alerts: one, grouped: many).
function doseEventIdsOf(data: ScheduledNotificationRequest['content']['data']): string[] {
  return [
    ...(typeof data?.eventId === 'string' ? [data.eventId] : []),
    ...(Array.isArray(data?.eventIds)
      ? data.eventIds.filter(
          (eventId): eventId is string => typeof eventId === 'string',
        )
      : []),
  ];
}

export function findScheduledDoseNotificationIds(
  requests: readonly ScheduledNotificationRequest[],
  eventIds: readonly string[],
): string[] {
  const targetEventIds = new Set(eventIds);
  const identifiers = new Set<string>();

  for (const request of requests) {
    if (doseEventIdsOf(request.content.data).some((eventId) => targetEventIds.has(eventId))) {
      identifiers.add(request.identifier);
    }
  }

  return [...identifiers];
}

// Every dose event that has an alert waiting on this phone.
export function scheduledDoseEventIds(
  requests: readonly ScheduledNotificationRequest[],
): Set<string> {
  return new Set(requests.flatMap((request) => doseEventIdsOf(request.content.data)));
}

// The dose events of the next `count` alert times (doses due in the same
// minute share one alert). Past doses are left out.
export function upcomingAlertEventIds(
  reminders: readonly { eventId: string; scheduledFor: string }[],
  count: number,
  now = Date.now(),
): string[] {
  return groupDoseNotificationRequests(
    reminders.filter((reminder) => new Date(reminder.scheduledFor).getTime() > now),
  )
    .slice(0, count)
    .flatMap((group) => group.reminders.map((reminder) => reminder.eventId));
}

export async function listScheduledDoseEventIds(): Promise<Set<string>> {
  const Notifications = await requireExpoNotifications();
  return scheduledDoseEventIds(await Notifications.getAllScheduledNotificationsAsync());
}

export async function scheduleGroupedDoseNotificationsWithAdapter(
  adapter: GroupedNotificationAdapter,
  reminders: readonly DoseNotificationRequest[],
  maxAlerts = Number.POSITIVE_INFINITY,
): Promise<Array<{ eventId: string; notificationId: string }>> {
  const scheduledIds: string[] = [];
  const identifiers: Array<{ eventId: string; notificationId: string }> = [];
  try {
    for (const group of groupDoseNotificationRequests(reminders).slice(0, maxAlerts)) {
      const notificationId = await adapter.schedule(group);
      scheduledIds.push(notificationId);
      identifiers.push(
        ...group.reminders.map((reminder) => ({
          eventId: reminder.eventId,
          notificationId,
        })),
      );
    }
    return identifiers;
  } catch (error) {
    await Promise.allSettled(
      [...new Set(scheduledIds)].map((identifier) =>
        adapter.cancel(identifier),
      ),
    );
    throw error;
  }
}

export async function requestMedicineNotificationPermission(): Promise<boolean> {
  const Notifications = await requireExpoNotifications();
  await flushPendingNotificationCancellations().catch(() => undefined);
  await ensureMedicineReminderChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// The system permission dialog only ever appears once per install; after
// that, requestPermissionsAsync() just silently returns the existing
// (denied) status. Without this, every reminder created while notifications
// stay off would re-show our own "enable notifications" nudge alert.
export async function hasShownNotificationSettingsNudge(): Promise<boolean> {
  const { default: AsyncStorage } = await import(
    '@react-native-async-storage/async-storage'
  );
  return (await AsyncStorage.getItem(NOTIFICATION_NUDGE_SHOWN_KEY)) === 'true';
}

export async function markNotificationSettingsNudgeShown(): Promise<void> {
  const { default: AsyncStorage } = await import(
    '@react-native-async-storage/async-storage'
  );
  await AsyncStorage.setItem(NOTIFICATION_NUDGE_SHOWN_KEY, 'true');
}

export async function scheduleDoseNotifications(
  events: readonly NotificationEvent[],
  content: NotificationContent,
): Promise<Array<{ eventId: string; notificationId: string }>> {
  const Notifications = await requireExpoNotifications();
  await ensureMedicineReminderChannel();
  const { channelId, sound } = getMedicineReminderSoundConfig();
  const futureEvents = events.filter(
    (event) => new Date(event.scheduledFor).getTime() > Date.now(),
  );
  return scheduleDoseNotificationsWithAdapter(
    {
      cancel: Notifications.cancelScheduledNotificationAsync,
      schedule: (event, notificationContent) =>
        Notifications.scheduleNotificationAsync({
          content: {
            body: `${notificationContent.tablets} tablet${
              notificationContent.tablets === 1 ? '' : 's'
            } · ${notificationContent.slot} · ${formatScheduledTime12Hour(
              event.scheduledFor,
            )}`,
            color: DOSE_SLOT_THEME[notificationContent.slotKey].accent,
            data: { eventId: event.eventId, route: '/home' },
            interruptionLevel: 'timeSensitive',
            badge: 1,
            sound,
            title: `Time for ${notificationContent.medicineName}`,
          },
          trigger: {
            channelId,
            date: new Date(event.scheduledFor),
            type: Notifications.SchedulableTriggerInputTypes.DATE,
          },
        }),
    },
    futureEvents,
    content,
  );
}

export async function scheduleGroupedDoseNotifications(
  reminders: readonly DoseNotificationRequest[],
): Promise<Array<{ eventId: string; notificationId: string }>> {
  const Notifications = await requireExpoNotifications();
  await ensureMedicineReminderChannel();
  const { channelId, sound } = getMedicineReminderSoundConfig();
  const futureReminders = reminders.filter(
    (reminder) => new Date(reminder.scheduledFor).getTime() > Date.now(),
  );
  const maxAlerts = await maxMedicineAlerts(Notifications);

  return scheduleGroupedDoseNotificationsWithAdapter(
    {
      cancel: Notifications.cancelScheduledNotificationAsync,
      schedule: (group) => {
        const first = group.reminders[0]!;
        const multiple = group.reminders.length > 1;
        const medicineList = group.reminders
          .map(
            (reminder) =>
              `${reminder.medicineName} (${reminder.tablets} tablet${
                reminder.tablets === 1 ? '' : 's'
              })`,
          )
          .join(', ');

        return Notifications.scheduleNotificationAsync({
          content: {
            body: multiple
              ? `${medicineList} · ${formatScheduledTime12Hour(
                  group.scheduledFor,
                )}`
              : `${first.tablets} tablet${
                  first.tablets === 1 ? '' : 's'
                } · ${first.slot} · ${formatScheduledTime12Hour(
                  group.scheduledFor,
                )}`,
            color: DOSE_SLOT_THEME[first.slotKey].accent,
            data: {
              eventId: first.eventId,
              eventIds: group.reminders.map((reminder) => reminder.eventId),
              route: '/home',
            },
            interruptionLevel: 'timeSensitive',
            badge: 1,
            sound,
            title: multiple
              ? `Time for ${group.reminders.length} medicines`
              : `Time for ${first.medicineName}`,
          },
          trigger: {
            channelId,
            date: new Date(group.scheduledFor),
            type: Notifications.SchedulableTriggerInputTypes.DATE,
          },
        });
      },
    },
    futureReminders,
    maxAlerts,
  );
}

export async function cancelDoseNotifications(
  identifiers: readonly string[],
): Promise<void> {
  const Notifications = await requireExpoNotifications();
  await Promise.all(
    [...new Set(identifiers)].map(
      Notifications.cancelScheduledNotificationAsync,
    ),
  );
}

export async function cancelScheduledDoseNotificationsForEvents(
  eventIds: readonly string[],
): Promise<void> {
  if (eventIds.length === 0) return;
  const Notifications = await requireExpoNotifications();
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  const identifiers = findScheduledDoseNotificationIds(requests, eventIds);
  await Promise.all(
    identifiers.map(Notifications.cancelScheduledNotificationAsync),
  );
}

export async function queueNotificationCancellations(
  identifiers: readonly string[],
): Promise<void> {
  if (identifiers.length === 0) return;
  const { default: AsyncStorage } = await import(
    '@react-native-async-storage/async-storage'
  );
  const stored = await AsyncStorage.getItem(PENDING_CANCELLATIONS_KEY);
  const previous = stored ? (JSON.parse(stored) as string[]) : [];
  await AsyncStorage.setItem(
    PENDING_CANCELLATIONS_KEY,
    JSON.stringify([...new Set([...previous, ...identifiers])]),
  );
}

export async function flushPendingNotificationCancellations(): Promise<void> {
  const [{ default: AsyncStorage }, Notifications] = await Promise.all([
    import('@react-native-async-storage/async-storage'),
    requireExpoNotifications(),
  ]);
  const stored = await AsyncStorage.getItem(PENDING_CANCELLATIONS_KEY);
  if (!stored) return;
  const identifiers = JSON.parse(stored) as string[];
  const results = await Promise.allSettled(
    identifiers.map(Notifications.cancelScheduledNotificationAsync),
  );
  const failed = identifiers.filter(
    (_, index) => results[index]?.status === 'rejected',
  );
  if (failed.length === 0) {
    await AsyncStorage.removeItem(PENDING_CANCELLATIONS_KEY);
  } else {
    await AsyncStorage.setItem(
      PENDING_CANCELLATIONS_KEY,
      JSON.stringify(failed),
    );
  }
}
