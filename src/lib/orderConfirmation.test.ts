import { describe, expect, it, vi } from 'vitest';

import { confirmPlacedOrder } from './orderConfirmation';

const order = {
  createdAt: '2026-08-01T08:00:00.000Z',
  id: 'order-1',
  orderNumber: 1042,
  paymentMethod: 'cod' as const,
  status: 'placed' as const,
  total: 98,
};

describe('order confirmation', () => {
  it('plays the success cue and presents a local receipt notification', async () => {
    const play = vi.fn(async () => undefined);
    const notify = vi.fn(async () => undefined);

    await confirmPlacedOrder({ notify, play }, order);

    expect(play).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(order);
  });

  it('does not turn a successful order into a failure when device feedback is unavailable', async () => {
    const notify = vi.fn(async () => {
      throw new Error('notifications unavailable');
    });
    const play = vi.fn(async () => {
      throw new Error('audio unavailable');
    });

    await expect(confirmPlacedOrder({ notify, play }, order)).resolves.toBeUndefined();
  });
});
