import { createClient } from 'npm:@supabase/supabase-js@2.110.8';

const ALERT_TO_EMAIL = 'medicokadapa@gmail.com';

type UnmatchedRow = {
  id: string;
  medicine_name: string;
  hospital_name: string | null;
  mobile: string | null;
  reason: 'medicine_not_found' | 'no_image';
  created_at: string;
};

function formatIst(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatRow(row: UnmatchedRow, index: number): string {
  return (
    `${index + 1}. ${row.medicine_name}\n` +
    `   Hospital: ${row.hospital_name || 'Unknown'}\n` +
    `   Patient mobile: ${row.mobile || 'Unknown'}\n` +
    `   Billed at: ${formatIst(row.created_at)}`
  );
}

function buildEmailText(rows: UnmatchedRow[]): string {
  const notFound = rows.filter((r) => r.reason === 'medicine_not_found');
  const noImage = rows.filter((r) => r.reason === 'no_image');
  const sections: string[] = [];

  if (notFound.length > 0) {
    sections.push(
      `NOT IN CATALOG (${notFound.length}) — these medicines don't exist in DrJiva yet, add them:\n\n` +
        notFound.map(formatRow).join('\n\n'),
    );
  }
  if (noImage.length > 0) {
    sections.push(
      `MISSING A PHOTO (${noImage.length}) — these matched an existing medicine but it has no photo:\n\n` +
        noImage.map(formatRow).join('\n\n'),
    );
  }

  return (
    `${rows.length} medicine${rows.length === 1 ? '' : 's'} from today's hospital bills need attention:\n\n` +
    sections.join('\n\n---\n\n')
  );
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const webhookSecret =
    request.headers.get('x-unmatched-medicine-webhook-secret') ?? '';
  if (!webhookSecret) {
    return Response.json({ error: 'Invalid webhook request' }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
    return Response.json(
      { error: 'Notification service is not configured' },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rows, error: fetchError } = await supabase
    .from('unmatched_medicine_requests')
    .select('id, medicine_name, hospital_name, mobile, reason, created_at')
    .is('notification_sent_at', null)
    .order('created_at', { ascending: true });

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }
  if (!rows || rows.length === 0) {
    return Response.json({ sent: false, reason: 'nothing pending' });
  }

  const ids = rows.map((row) => row.id);
  let sendError: string | null = null;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'DrJiva Alerts <onboarding@resend.dev>',
        to: [ALERT_TO_EMAIL],
        subject: `${rows.length} medicine${rows.length === 1 ? '' : 's'} to review — ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
        text: buildEmailText(rows as UnmatchedRow[]),
      }),
    });
    if (!res.ok) {
      sendError = `Resend responded ${res.status}: ${await res.text()}`;
    }
  } catch (cause) {
    sendError = cause instanceof Error ? cause.message : String(cause);
  }

  const { data: completedCount, error: completeError } = await supabase.rpc(
    'complete_unmatched_medicine_digest',
    {
      p_request_ids: ids,
      p_webhook_secret: webhookSecret,
      p_error: sendError,
    },
  );
  if (completeError) {
    return Response.json({ error: completeError.message }, { status: 500 });
  }

  if (sendError) {
    return Response.json({ error: sendError }, { status: 502 });
  }
  return Response.json({ sent: true, count: completedCount });
});
