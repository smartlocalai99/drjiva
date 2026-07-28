import { DOSE_SLOT_THEME } from './doseSlotTheme';
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
  const [{ Platform }, Notifications] = await Promise.all([
    import('react-native'),
    import('expo-notifications'),
  ]);
  await flushPendingNotificationCancellations().catch(() => undefined);
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('medicine-reminders', {
      importance: Notifications.AndroidImportance.HIGH,
      name: 'Medicine reminders',
      vibrationPattern: [0, 250, 150, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleDoseNotifications(
  events: readonly NotificationEvent[],
  content: NotificationContent,
): Promise<Array<{ eventId: string; notificationId: string }>> {
  const Notifications = await import('expo-notifications');
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
            sound: 'default',
            title: `Time for ${notificationContent.medicineName}`,
          },
          trigger: {
            channelId: 'medicine-reminders',
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
  const Notifications = await import('expo-notifications');
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
    import('expo-notifications'),
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
