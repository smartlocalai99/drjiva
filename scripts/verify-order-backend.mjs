import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const dashboardAccessCode = process.env.ORDER_DASHBOARD_ACCESS_CODE;

if (!supabaseUrl || !supabaseKey || !dashboardAccessCode) {
  throw new Error(
    'Set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_KEY, and ORDER_DASHBOARD_ACCESS_CODE.',
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error: authError } = await supabase.auth.signInAnonymously();
assert.equal(authError, null, authError?.message);

const { data: patient, error: patientError } = await supabase
  .from('patients')
  .select('id, name, mobile')
  .not('name', 'is', null)
  .limit(1)
  .single();
assert.equal(patientError, null, patientError?.message);
assert.ok(patient?.id, 'A patient is required for order verification.');

const { data: medicine, error: medicineError } = await supabase
  .from('medicines')
  .select('id, name, price')
  .ilike('hospital_name', 'ASIAN MULTI SPECIALITY HOSPITALS')
  .limit(1)
  .single();
assert.equal(medicineError, null, medicineError?.message);
assert.ok(medicine?.id, 'A priced Asian Hospitals medicine is required.');

const clientRequestId = crypto.randomUUID();
const rpcInput = {
  p_address: {
    area: 'Integration Test Area',
    building: 'Verification House',
    city: 'Kadapa',
    customLabel: '',
    label: 'Other',
    landmark: 'Automated order verification',
    phone: String(patient.mobile ?? '').replace(/\D/g, '').slice(-10),
    pinCode: '516001',
    recipientName: patient.name,
    state: 'Andhra Pradesh',
  },
  p_client_request_id: clientRequestId,
  p_items: [{ medicineId: medicine.id, quantity: 1 }],
  p_patient_id: patient.id,
};

const first = await supabase.rpc('place_cod_order', rpcInput);
assert.equal(first.error, null, first.error?.message);
assert.ok(first.data?.id, 'Order RPC must return an order id.');
assert.equal(first.data.paymentMethod, 'cod');
assert.equal(first.data.status, 'placed');
assert.equal(Number(first.data.total), Number(medicine.price ?? 49));

const retry = await supabase.rpc('place_cod_order', rpcInput);
assert.equal(retry.error, null, retry.error?.message);
assert.equal(retry.data?.id, first.data.id, 'Retry must return the same order.');

const dashboard = await supabase.rpc('get_hospital_order', {
  p_access_code: dashboardAccessCode,
  p_order_id: first.data.id,
});
assert.equal(dashboard.error, null, dashboard.error?.message);
assert.equal(dashboard.data?.id, first.data.id);
assert.equal(dashboard.data?.items?.length, 1);

const cancelled = await supabase.rpc('update_hospital_order_status', {
  p_access_code: dashboardAccessCode,
  p_order_id: first.data.id,
  p_status: 'cancelled',
});
assert.equal(cancelled.error, null, cancelled.error?.message);
assert.equal(cancelled.data?.status, 'cancelled');

console.log(
  JSON.stringify({
    idempotent: true,
    orderId: first.data.id,
    orderNumber: first.data.orderNumber,
    status: cancelled.data.status,
  }),
);
