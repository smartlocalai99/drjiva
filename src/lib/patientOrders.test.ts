import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ensureSessionMock, rpcMock } = vi.hoisted(() => ({
  ensureSessionMock: vi.fn(async () => 'owner-user'),
  rpcMock: vi.fn(),
}));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: ensureSessionMock,
}));

vi.mock('./supabase', () => ({
  supabase: { rpc: rpcMock },
}));

import {
  countActiveOrders,
  getPatientOrder,
  listPatientOrders,
  mapPatientOrder,
} from './patientOrders';

const orderRow = {
  address: {
    area: 'Jayanagar',
    building: 'Flat 4',
    city: 'Kadapa',
    formatted: 'Flat 4, Jayanagar, Kadapa',
    label: 'Home',
    landmark: '',
    pinCode: '516001',
    state: 'Andhra Pradesh',
  },
  assignedAt: '2026-08-01T09:00:00.000Z',
  createdAt: '2026-08-01T08:00:00.000Z',
  currency: 'INR',
  customerName: 'Anita Reddy',
  customerPhone: '9876543210',
  deliveryFee: '0.00',
  hospital: {
    address: 'Railway Road, Kadapa',
    id: 'hospital-1',
    name: 'Dr Jiva Hospital',
    phone: '9876500000',
  },
  id: 'order-1',
  items: [
    {
      id: 'item-1',
      imageUrl: null,
      lineTotal: '98.00',
      medicineId: 'medicine-1',
      name: 'Paracetamol',
      packDisplay: '10 tablets',
      quantity: 2,
      unitPrice: '49.00',
    },
  ],
  orderNumber: 1042,
  paymentMethod: 'cod',
  paymentStatus: 'pending',
  riderName: 'Ravi',
  riderPhone: '9988776655',
  status: 'assigned',
  subtotal: '98.00',
  total: '98.00',
  updatedAt: '2026-08-01T09:00:00.000Z',
};

describe('patient order normalization', () => {
  it('normalizes money values and rider details from the RPC result', () => {
    expect(mapPatientOrder(orderRow)).toMatchObject({
      deliveryFee: 0,
      id: 'order-1',
      orderNumber: 1042,
      riderName: 'Ravi',
      riderPhone: '9988776655',
      status: 'assigned',
      subtotal: 98,
      total: 98,
    });
  });

  it('counts only orders that still need delivery', () => {
    expect(
      countActiveOrders([
        mapPatientOrder(orderRow),
        mapPatientOrder({ ...orderRow, id: 'order-2', status: 'delivered' }),
        mapPatientOrder({ ...orderRow, id: 'order-3', status: 'cancelled' }),
        mapPatientOrder({ ...orderRow, id: 'order-4', status: 'collected' }),
      ]),
    ).toBe(2);
  });
});

describe('patient order RPCs', () => {
  beforeEach(() => {
    ensureSessionMock.mockClear();
    rpcMock.mockReset();
  });

  it('loads the patient order history from the owner-scoped RPC', async () => {
    rpcMock.mockResolvedValue({ data: [orderRow], error: null });

    await expect(listPatientOrders('patient-1')).resolves.toHaveLength(1);
    expect(ensureSessionMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith('list_patient_orders', {
      p_patient_id: 'patient-1',
    });
  });

  it('loads one order for its matching patient', async () => {
    rpcMock.mockResolvedValue({ data: orderRow, error: null });

    await expect(getPatientOrder('patient-1', 'order-1')).resolves.toMatchObject({
      id: 'order-1',
      orderNumber: 1042,
    });
    expect(rpcMock).toHaveBeenCalledWith('get_patient_order', {
      p_order_id: 'order-1',
      p_patient_id: 'patient-1',
    });
  });
});
