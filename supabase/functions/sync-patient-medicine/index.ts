import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

import { syncPatientMedicine } from '../_shared/patientMedicineSync.ts';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const webhookSecret =
    request.headers.get('x-patient-medicine-sync-secret') ?? '';
  let customMedicineId = '';
  try {
    const payload = await request.json();
    customMedicineId =
      typeof payload?.custom_medicine_id === 'string'
        ? payload.custom_medicine_id
        : '';
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!uuidPattern.test(customMedicineId) || !webhookSecret) {
    return Response.json({ error: 'Invalid webhook request' }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const legacyServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  let serviceRoleKey = legacyServiceRoleKey;
  if (!serviceRoleKey && secretKeysJson) {
    try {
      serviceRoleKey = JSON.parse(secretKeysJson).default;
    } catch {
      serviceRoleKey = undefined;
    }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: 'Patient medicine sync service is not configured' },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const result = await syncPatientMedicine(customMedicineId, {
      claim: async (id) => {
        const { data, error } = await supabase.rpc(
          'claim_patient_custom_medicine_sync',
          {
            p_custom_medicine_id: id,
            p_webhook_secret: webhookSecret,
          },
        );
        if (error) throw error;
        return data;
      },
      complete: async (input) => {
        const { data, error } = await supabase.rpc(
          'complete_patient_custom_medicine_sync',
          {
            p_custom_medicine_id: input.customMedicineId,
            p_shared_image_path: input.sharedImagePath,
            p_webhook_secret: webhookSecret,
          },
        );
        if (error) throw error;
        return data;
      },
      download: async (path) => {
        const { data, error } = await supabase.storage
          .from('patient-medicine-images')
          .download(path, {}, { cache: 'no-store' });
        if (error || !data) {
          throw error ?? new Error('Private patient medicine image is missing.');
        }
        return data;
      },
      fail: async (message) => {
        const { error } = await supabase.rpc(
          'fail_patient_custom_medicine_sync',
          {
            p_custom_medicine_id: customMedicineId,
            p_error: message,
            p_webhook_secret: webhookSecret,
          },
        );
        if (error) console.error('Unable to record medicine sync failure', error);
      },
      getPublicUrl: (path) =>
        supabase.storage.from('medicine-images').getPublicUrl(path).data
          .publicUrl,
      upload: async (path, body) => {
        const { error } = await supabase.storage
          .from('medicine-images')
          .upload(path, body, {
            cacheControl: '3600',
            contentType: body.type || 'image/jpeg',
            upsert: true,
          });
        if (error) throw error;
      },
    });

    return Response.json(result);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const status =
      typeof cause === 'object' && cause && 'code' in cause &&
        cause.code === '42501'
        ? 401
        : 500;
    return Response.json({ error: message }, { status });
  }
});
