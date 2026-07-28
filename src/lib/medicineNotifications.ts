type NotificationEvent = {
  eventId: string;
  scheduledFor: string;
};

type NotificationContent = {
  medicineName: string;
  slot: string;
  tablets: number;
};

type NotificationAdapter = {
  cancel: (identifier: string) => Promise<void>;
  schedule: (
    event: NotificationEvent,
    content: NotificationContent,
  ) => Promise<string>;
};

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
            } · ${notificationContent.slot}`,
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
