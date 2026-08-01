import type { SavedAddress } from './addresses';
import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

export type OrderItemInput = {
  medicineId: string;
  quantity: number;
};

export type PlacedOrder = {
  createdAt: string;
  id: string;
  orderNumber: number;
  paymentMethod: 'cod';
  status: 'placed';
  total: number;
};

export type PlaceCodOrderInput = {
  address: SavedAddress;
  clientRequestId: string;
  items: readonly OrderItemInput[];
  patientId: string;
};

type RpcError = {
  code?: string;
  message?: string;
};

const SAFE_ORDER_ERROR_CODES = new Set(['22023', '42501', 'P0002']);

export function createOrderRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256),
  );
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join(''),
  ].join('-');
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

export function buildOrderAddressPayload(address: SavedAddress) {
  return {
    area: address.area.trim(),
    building: address.building.trim(),
    city: address.city.trim(),
    customLabel: address.customLabel.trim(),
    label: address.label,
    landmark: address.landmark.trim(),
    phone: digits(address.phone).slice(-10),
    pinCode: digits(address.pinCode),
    recipientName: address.recipientName.trim(),
    state: address.state.trim(),
  };
}

export function buildOrderItemsPayload(items: readonly OrderItemInput[]) {
  const activeItems = items.filter((item) => item.quantity > 0);
  for (const item of activeItems) {
    if (
      !item.medicineId.trim() ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20
    ) {
      throw new Error('Choose between 1 and 20 units for each medicine.');
    }
  }
  if (activeItems.length === 0) {
    throw new Error('Your cart is empty.');
  }
  return activeItems.map((item) => ({
    medicineId: item.medicineId.trim(),
    quantity: item.quantity,
  }));
}

function orderError(error: RpcError): Error {
  if (
    error.code &&
    SAFE_ORDER_ERROR_CODES.has(error.code) &&
    error.message?.trim()
  ) {
    return new Error(error.message.trim());
  }
  return new Error('We could not place your order. Please try again.');
}

function parsePlacedOrder(value: unknown): PlacedOrder {
  if (!value || typeof value !== 'object') {
    throw new Error('We could not confirm your order. Please try again.');
  }
  const row = value as Record<string, unknown>;
  const orderNumber = Number(row.orderNumber);
  const total = Number(row.total);
  if (
    typeof row.id !== 'string' ||
    !row.id ||
    !Number.isSafeInteger(orderNumber) ||
    orderNumber < 1 ||
    !Number.isFinite(total) ||
    total < 0 ||
    row.paymentMethod !== 'cod' ||
    row.status !== 'placed' ||
    typeof row.createdAt !== 'string'
  ) {
    throw new Error('We could not confirm your order. Please try again.');
  }
  return {
    createdAt: row.createdAt,
    id: row.id,
    orderNumber,
    paymentMethod: 'cod',
    status: 'placed',
    total,
  };
}

export async function placeCodOrder(
  input: PlaceCodOrderInput,
): Promise<PlacedOrder> {
  await ensureSecureReportSession();
  const { data, error } = await supabase.rpc('place_cod_order', {
    p_address: buildOrderAddressPayload(input.address),
    p_client_request_id: input.clientRequestId,
    p_items: buildOrderItemsPayload(input.items),
    p_patient_id: input.patientId,
  });

  if (error) {
    throw orderError(error);
  }
  return parsePlacedOrder(data);
}
