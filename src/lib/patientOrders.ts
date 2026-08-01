import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

export const PATIENT_ORDER_STATUSES = [
  'placed',
  'shared',
  'assigned',
  'collected',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;

export type PatientOrderStatus = (typeof PATIENT_ORDER_STATUSES)[number];

export type PatientOrderItem = {
  id: string;
  imageUrl: string | null;
  lineTotal: number;
  medicineId: string;
  name: string;
  packDisplay: string;
  quantity: number;
  unitPrice: number;
};

export type PatientOrder = {
  address: {
    area: string;
    building: string;
    city: string;
    formatted: string;
    label: string;
    landmark: string;
    pinCode: string;
    state: string;
  };
  assignedAt: string | null;
  createdAt: string;
  deliveryFee: number;
  hospital: {
    address: string;
    id: string;
    name: string;
    phone: string;
  };
  id: string;
  items: PatientOrderItem[];
  orderNumber: number;
  riderName: string | null;
  riderPhone: string | null;
  status: PatientOrderStatus;
  subtotal: number;
  total: number;
  updatedAt: string;
};

const ACTIVE_STATUSES = new Set<PatientOrderStatus>([
  'placed',
  'shared',
  'assigned',
  'collected',
  'out_for_delivery',
]);

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}.`);
  }
  return value;
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return stringValue(value, field);
}

function numberValue(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid ${field}.`);
  }
  return parsed;
}

function mapOrderItem(value: unknown): PatientOrderItem {
  const row = record(value, 'Invalid order item.');
  const quantity = numberValue(row.quantity, 'item quantity');
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error('Invalid item quantity.');
  }
  return {
    id: stringValue(row.id, 'item id'),
    imageUrl: nullableString(row.imageUrl, 'item image'),
    lineTotal: numberValue(row.lineTotal, 'item total'),
    medicineId: stringValue(row.medicineId, 'medicine id'),
    name: stringValue(row.name, 'medicine name'),
    packDisplay: stringValue(row.packDisplay, 'medicine pack'),
    quantity,
    unitPrice: numberValue(row.unitPrice, 'item price'),
  };
}

export function mapPatientOrder(value: unknown): PatientOrder {
  const row = record(value, 'Invalid order.');
  const address = record(row.address, 'Invalid delivery address.');
  const hospital = record(row.hospital, 'Invalid hospital.');
  const status = stringValue(row.status, 'order status');
  if (!PATIENT_ORDER_STATUSES.includes(status as PatientOrderStatus)) {
    throw new Error('Invalid order status.');
  }
  if (!Array.isArray(row.items)) {
    throw new Error('Invalid order items.');
  }
  const orderNumber = numberValue(row.orderNumber, 'order number');
  if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) {
    throw new Error('Invalid order number.');
  }

  return {
    address: {
      area: stringValue(address.area, 'address area'),
      building: stringValue(address.building, 'address building'),
      city: stringValue(address.city, 'address city'),
      formatted: stringValue(address.formatted, 'formatted address'),
      label: stringValue(address.label, 'address label'),
      landmark: stringValue(address.landmark, 'address landmark'),
      pinCode: stringValue(address.pinCode, 'address pin code'),
      state: stringValue(address.state, 'address state'),
    },
    assignedAt: nullableString(row.assignedAt, 'assignment time'),
    createdAt: stringValue(row.createdAt, 'created time'),
    deliveryFee: numberValue(row.deliveryFee, 'delivery fee'),
    hospital: {
      address: stringValue(hospital.address, 'hospital address'),
      id: stringValue(hospital.id, 'hospital id'),
      name: stringValue(hospital.name, 'hospital name'),
      phone: stringValue(hospital.phone, 'hospital phone'),
    },
    id: stringValue(row.id, 'order id'),
    items: row.items.map(mapOrderItem),
    orderNumber,
    riderName: nullableString(row.riderName, 'rider name'),
    riderPhone: nullableString(row.riderPhone, 'rider phone'),
    status: status as PatientOrderStatus,
    subtotal: numberValue(row.subtotal, 'subtotal'),
    total: numberValue(row.total, 'total'),
    updatedAt: stringValue(row.updatedAt, 'updated time'),
  };
}

export function countActiveOrders(orders: readonly PatientOrder[]): number {
  return orders.filter((order) => ACTIVE_STATUSES.has(order.status)).length;
}

export function isActiveOrderStatus(status: PatientOrderStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function patientOrderStatusLabel(status: PatientOrderStatus): string {
  const labels: Record<PatientOrderStatus, string> = {
    assigned: 'Rider assigned',
    cancelled: 'Cancelled',
    collected: 'Collected from hospital',
    delivered: 'Delivered',
    out_for_delivery: 'Out for delivery',
    placed: 'Order placed',
    shared: 'Finding a rider',
  };
  return labels[status];
}

function patientOrderError(): Error {
  return new Error('We could not load your orders. Please try again.');
}

export async function listPatientOrders(
  patientId: string,
): Promise<PatientOrder[]> {
  await ensureSecureReportSession();
  const { data, error } = await supabase.rpc('list_patient_orders', {
    p_patient_id: patientId,
  });
  if (error || !Array.isArray(data)) {
    throw patientOrderError();
  }
  try {
    return data.map(mapPatientOrder);
  } catch {
    throw patientOrderError();
  }
}

export async function getPatientOrder(
  patientId: string,
  orderId: string,
): Promise<PatientOrder> {
  await ensureSecureReportSession();
  const { data, error } = await supabase.rpc('get_patient_order', {
    p_order_id: orderId,
    p_patient_id: patientId,
  });
  if (error) {
    throw patientOrderError();
  }
  try {
    return mapPatientOrder(data);
  } catch {
    throw patientOrderError();
  }
}
