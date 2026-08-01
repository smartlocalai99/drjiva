import { describe, expect, it } from 'vitest';

import { buildOrderNotification } from './orderNotification';

describe('buildOrderNotification', () => {
  it('keeps the full customer, phone, address, medicines, and COD total in the push body', () => {
    const notification = buildOrderNotification({
      address: { formatted: '4 Main Road, Kadapa, Andhra Pradesh, 516001' },
      customerName: 'Anita Reddy',
      customerPhone: '9876543210',
      id: '846703ff-5862-4cda-8c3c-ef5807b17b11',
      items: [
        { name: 'Paracetamol 500 mg', quantity: 2 },
        { name: 'Vitamin C', quantity: 1 },
      ],
      orderNumber: 1024,
      total: 147,
    });

    expect(notification).toEqual({
      badge: '/badge-96.png',
      body:
        'Anita Reddy · 9876543210\n2× Paracetamol 500 mg, 1× Vitamin C\n₹147 COD\n4 Main Road, Kadapa, Andhra Pradesh, 516001',
      data: {
        orderId: '846703ff-5862-4cda-8c3c-ef5807b17b11',
        url: '/?order=846703ff-5862-4cda-8c3c-ef5807b17b11',
      },
      icon: '/icon-192.png',
      tag: 'order-846703ff-5862-4cda-8c3c-ef5807b17b11',
      title: 'New order ORD-1024',
    });
  });
});
