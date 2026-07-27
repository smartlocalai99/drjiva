// Deno Edge Function — proxies OTP send/verify to Fast2SMS so the API key
// never ships inside the mobile app bundle.
//
// Required secrets (set via `supabase secrets set`):
//   FAST2SMS_API_KEY        — your Fast2SMS authorization key
//   FAST2SMS_OTP_ID         — your DLT-approved OTP template id
//   FAST2SMS_VARIABLES_VALUES (optional) — template placeholder values, "|"-separated

const FAST2SMS_API_KEY = Deno.env.get('FAST2SMS_API_KEY');
const FAST2SMS_OTP_ID = Deno.env.get('FAST2SMS_OTP_ID') ?? '';
const FAST2SMS_VARIABLES_VALUES = Deno.env.get('FAST2SMS_VARIABLES_VALUES') ?? '';

const OTP_LENGTH = 4;
const OTP_EXPIRY_MINUTES = 15;

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Origin': '*',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function generateOtp(length: number): string {
  const digits = '0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => digits[byte % 10]).join('');
}

async function fast2sms(path: 'send' | 'verify', body: Record<string, unknown>) {
  const response = await fetch(`https://www.fast2sms.com/dev/otp/${path}`, {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      authorization: FAST2SMS_API_KEY ?? '',
    },
    method: 'POST',
  });

  const data = await response.json().catch(() => ({}));
  return data as { return?: boolean; message?: unknown };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!FAST2SMS_API_KEY) {
    return jsonResponse({ error: 'FAST2SMS_API_KEY is not configured' }, 500);
  }

  let payload: { action?: string; code?: string; phone?: string };

  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { action, code, phone } = payload;
  const mobile = (phone ?? '').replace(/\D/g, '').slice(-10);

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    return jsonResponse({ error: 'A valid 10-digit Indian mobile number is required' }, 400);
  }

  if (action === 'send' || action === 'resend') {
    const otp = generateOtp(OTP_LENGTH);
    const data = await fast2sms('send', {
      mobile,
      otp,
      otp_expiry: OTP_EXPIRY_MINUTES,
      otp_id: FAST2SMS_OTP_ID,
      otp_length: OTP_LENGTH,
      variables_values: FAST2SMS_VARIABLES_VALUES,
    });

    if (data.return !== true) {
      return jsonResponse({ error: 'Failed to send OTP', message: data.message }, 502);
    }

    return jsonResponse({ ok: true });
  }

  if (action === 'verify') {
    if (!code) {
      return jsonResponse({ error: 'code is required' }, 400);
    }

    const data = await fast2sms('verify', { mobile, otp: code });
    return jsonResponse({ ok: data.return === true });
  }

  return jsonResponse({ error: 'Unknown action' }, 400);
});
