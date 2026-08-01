import type { PlacedOrder } from './orders';

type OrderConfirmationAdapter = {
  notify: (order: PlacedOrder) => Promise<void>;
  play: () => Promise<void> | void;
};

export async function confirmPlacedOrder(
  adapter: OrderConfirmationAdapter,
  order: PlacedOrder,
): Promise<void> {
  await Promise.allSettled([
    Promise.resolve().then(() => adapter.play()),
    adapter.notify(order),
  ]);
}
