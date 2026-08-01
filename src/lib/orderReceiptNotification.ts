import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { requireExpoNotifications } from './expoNotifications';
import type { PlacedOrder } from './orders';

function orderSuccessSound(): { channelId: string; sound: string } {
  const extras = Constants.expoConfig?.extra;
  const channel = extras?.orderSuccessChannel;
  const configuredSound =
    Platform.OS === 'ios'
      ? extras?.orderSuccessSoundIOS
      : extras?.orderSuccessSoundAndroid;
  return {
    channelId:
      typeof channel === 'string' && channel ? channel : 'order-success-v1',
    sound:
      typeof configuredSound === 'string' && configuredSound
        ? configuredSound
        : 'default',
  };
}

export async function showOrderReceiptNotification(
  order: PlacedOrder,
): Promise<void> {
  const Notifications = await requireExpoNotifications();
  const permission = await Notifications.getPermissionsAsync();
  const granted = permission.granted
    ? true
    : (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) {
    return;
  }

  const { channelId, sound } = orderSuccessSound();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      description: 'Receipts for successfully placed medicine orders',
      enableLights: true,
      enableVibrate: true,
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#22C55E',
      name: 'Order confirmations',
      showBadge: true,
      sound,
      vibrationPattern: [0, 180, 80, 220],
    });
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      badge: 1,
      body: `Your cash-on-delivery order is confirmed. Amount: ₹${order.total.toFixed(2)}.`,
      data: { orderId: order.id, route: '/orders' },
      sound,
      title: `Order ORD-${order.orderNumber} placed successfully`,
    },
    trigger: Platform.OS === 'android' ? { channelId } : null,
  });
}
