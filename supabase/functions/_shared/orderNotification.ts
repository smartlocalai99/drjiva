type OrderNotificationInput = {
  address: { formatted: string };
  customerName: string;
  customerPhone: string;
  id: string;
  items: Array<{ name: string; quantity: number }>;
  orderNumber: number;
  total: number | string;
};

export type OrderNotification = {
  badge: string;
  body: string;
  data: { orderId: string; url: string };
  icon: string;
  tag: string;
  title: string;
};

function formatRupees(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '₹0';
  }
  return `₹${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

export function buildOrderNotification(
  order: OrderNotificationInput,
): OrderNotification {
  const medicines = order.items
    .map((item) => `${item.quantity}× ${item.name}`)
    .join(', ');

  return {
    badge: '/badge-96.png',
    body: [
      `${order.customerName} · ${order.customerPhone}`,
      medicines,
      `${formatRupees(order.total)} COD`,
      order.address.formatted,
    ].join('\n'),
    data: {
      orderId: order.id,
      url: `/?order=${order.id}`,
    },
    icon: '/icon-192.png',
    tag: `order-${order.id}`,
    title: `New order ORD-${order.orderNumber}`,
  };
}
