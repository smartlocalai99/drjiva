import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureSessionMock, rpcMock } = vi.hoisted(() => ({
  ensureSessionMock: vi.fn(async () => 'anonymous-user'),
  rpcMock: vi.fn(),
}));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: ensureSessionMock,
}));

vi.mock('./supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import {
  buildOrderAddressPayload,
  buildOrderItemsPayload,
  createOrderRequestId,
  placeCodOrder,
} from './orders';

describe('order payloads', () => {
  it('creates UUID request ids suitable for database idempotency keys', () => {
    const first = createOrderRequestId();
    const second = createOrderRequestId();
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(second).not.toBe(first);
  });

  it('normalizes the delivery snapshot before it leaves the device', () => {
    expect(
      buildOrderAddressPayload({
        area: '  Jayanagar  ',
        building: '  Flat 4  ',
        city: ' Kadapa ',
        customLabel: ' Parents ',
        id: 'address-1',
        isDefault: true,
        label: 'Other',
        landmark: ' Near park ',
        phone: '+91 98765-43210',
        pinCode: '516 001',
        recipientName: ' Anita Reddy ',
        state: ' Andhra Pradesh ',
      }),
    ).toEqual({
      area: 'Jayanagar',
      building: 'Flat 4',
      city: 'Kadapa',
      customLabel: 'Parents',
      label: 'Other',
      landmark: 'Near park',
      phone: '9876543210',
      pinCode: '516001',
      recipientName: 'Anita Reddy',
      state: 'Andhra Pradesh',
    });
  });

  it('drops removed cart lines and rejects quantities outside the database boundary', () => {
    expect(
      buildOrderItemsPayload([
        { medicineId: 'medicine-a', quantity: 2 },
        { medicineId: 'medicine-removed', quantity: 0 },
      ]),
    ).toEqual([{ medicineId: 'medicine-a', quantity: 2 }]);

    expect(() =>
      buildOrderItemsPayload([{ medicineId: 'medicine-a', quantity: 21 }]),
    ).toThrow('Choose between 1 and 20 units for each medicine.');
  });
});

describe('placeCodOrder', () => {
  beforeEach(() => {
    ensureSessionMock.mockClear();
    rpcMock.mockReset();
  });

  it('uses the caller request id and returns the validated server receipt', async () => {
    rpcMock.mockResolvedValue({
      data: {
        createdAt: '2026-08-01T08:00:00.000Z',
        id: 'order-1',
        orderNumber: 1042,
        paymentMethod: 'cod',
        status: 'placed',
        total: '98.00',
      },
      error: null,
    });

    await expect(
      placeCodOrder({
        address: {
          area: 'Jayanagar',
          building: 'Flat 4',
          city: 'Kadapa',
          customLabel: '',
          id: 'address-1',
          isDefault: true,
          label: 'Home',
          landmark: '',
          phone: '9876543210',
          pinCode: '516001',
          recipientName: 'Anita Reddy',
          state: 'Andhra Pradesh',
        },
        clientRequestId: 'request-1',
        items: [{ medicineId: 'medicine-a', quantity: 2 }],
        patientId: 'patient-1',
      }),
    ).resolves.toEqual({
      createdAt: '2026-08-01T08:00:00.000Z',
      id: 'order-1',
      orderNumber: 1042,
      paymentMethod: 'cod',
      status: 'placed',
      total: 98,
    });

    expect(ensureSessionMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith('place_cod_order', {
      p_address: {
        area: 'Jayanagar',
        building: 'Flat 4',
        city: 'Kadapa',
        customLabel: '',
        label: 'Home',
        landmark: '',
        phone: '9876543210',
        pinCode: '516001',
        recipientName: 'Anita Reddy',
        state: 'Andhra Pradesh',
      },
      p_client_request_id: 'request-1',
      p_items: [{ medicineId: 'medicine-a', quantity: 2 }],
      p_patient_id: 'patient-1',
    });
  });

  it('keeps safe database guidance and hides unexpected backend details', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: '22023', message: 'A medicine in your cart is no longer available.' },
    });
    await expect(
      placeCodOrder({
        address: {
          area: 'Area',
          building: 'Building',
          city: 'Kadapa',
          customLabel: '',
          id: 'address-1',
          isDefault: true,
          label: 'Home',
          landmark: '',
          phone: '9876543210',
          pinCode: '516001',
          recipientName: 'Anita',
          state: 'Andhra Pradesh',
        },
        clientRequestId: 'request-1',
        items: [{ medicineId: 'medicine-a', quantity: 1 }],
        patientId: 'patient-1',
      }),
    ).rejects.toThrow('A medicine in your cart is no longer available.');

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'XX000', message: 'internal relation name and stack detail' },
    });
    await expect(
      placeCodOrder({
        address: {
          area: 'Area',
          building: 'Building',
          city: 'Kadapa',
          customLabel: '',
          id: 'address-1',
          isDefault: true,
          label: 'Home',
          landmark: '',
          phone: '9876543210',
          pinCode: '516001',
          recipientName: 'Anita',
          state: 'Andhra Pradesh',
        },
        clientRequestId: 'request-2',
        items: [{ medicineId: 'medicine-a', quantity: 1 }],
        patientId: 'patient-1',
      }),
    ).rejects.toThrow('We could not place your order. Please try again.');
  });
});
