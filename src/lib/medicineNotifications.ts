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

type NotificationContent = {
  medicineName: string;
  slot: string;
  slotKey: DoseSlot;
  tablets: number;
};

type NotificationAdapter = {
  cancel: (identifier: string) => Promise<void>;
  schedule: (
    event: NotificationEvent,
    content: NotificationContent,
  ) => Promise<string>;
};

const PENDING_CANCELLATIONS_KEY = 'drjiva.pendingNotificationCancellations';
const NOTIFICATION_NUDGE_SHOWN_KEY = 'drjiva.notificationSettingsNudgeShown';
const DEFAULT_REMINDER_CHANNEL = 'medicine-reminders';

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
    lightColor: '#2563EB',
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

export async function cancelDoseNotifications(
  identifiers: readonly string[],
): Promise<void> {
  const Notifications = await requireExpoNotifications();
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
