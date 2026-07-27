import { supabase } from './supabase';

const INDIAN_PHONE_PATTERN = /^[6-9]\d{9}$/;

function toMobile(phone: string): string {
  const mobile = phone.replace(/\D/g, '').slice(-10);

  if (!INDIAN_PHONE_PATTERN.test(mobile)) {
    throw new Error('Invalid Indian mobile number.');
  }

  return mobile;
}

// Proxies to the `otp` Supabase Edge Function, which holds the Fast2SMS
// API key server-side — the app itself never sees that credential.
export async function sendOtp(
  phone: string,
): Promise<{ ok: true }> {
  const { data, error } = await supabase.functions.invoke('otp', {
    body: { action: 'send', phone: toMobile(phone) },
  });

  if (error || !data?.ok) {
    throw error ?? new Error('Unable to send the code.');
  }

  return { ok: true };
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<{ ok: boolean }> {
  const { data, error } = await supabase.functions.invoke('otp', {
    body: { action: 'verify', code, phone: toMobile(phone) },
  });

  if (error) {
    return { ok: false };
  }

  return { ok: Boolean(data?.ok) };
}
