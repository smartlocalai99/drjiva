import { isNativeModuleAvailable } from './nativeModuleAvailability';

type ExpoNotifications = typeof import('expo-notifications');

const NOTIFICATIONS_NATIVE_MODULE = 'ExpoPushTokenManager';
export const NOTIFICATIONS_REBUILD_MESSAGE =
  'Notifications are unavailable in this app build. Rebuild and reinstall the development app to include expo-notifications.';

let notificationsModulePromise: Promise<ExpoNotifications> | undefined;

export function isExpoNotificationsAvailable(): boolean {
  return isNativeModuleAvailable(NOTIFICATIONS_NATIVE_MODULE);
}

export async function loadExpoNotifications(): Promise<ExpoNotifications | null> {
  if (!isExpoNotificationsAvailable()) {
    return null;
  }

  notificationsModulePromise ??= import('expo-notifications');
  return notificationsModulePromise;
}

export async function requireExpoNotifications(): Promise<ExpoNotifications> {
  const Notifications = await loadExpoNotifications();
  if (!Notifications) {
    throw new Error(NOTIFICATIONS_REBUILD_MESSAGE);
  }
  return Notifications;
}
