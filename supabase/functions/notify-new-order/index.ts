import { createClient } from 'npm:@supabase/supabase-js@2.110.8';
import webpush from 'npm:web-push@3.6.7';

import { buildOrderNotification } from '../_shared/orderNotification.ts';

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  keys: { auth: string; p256dh: string };
};

type ClaimedNotification = {
  order: Parameters<typeof buildOrderNotification>[0];
  subscriptions: PushSubscriptionRow[];
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const webhookSecret = request.headers.get('x-order-webhook-secret') ?? '';
  let orderId = '';
  try {
    const payload = await request.json();
    orderId = typeof payload?.order_id === 'string' ? payload.order_id : '';
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!uuidPattern.test(orderId) || !webhookSecret) {
    return Response.json({ error: 'Invalid webhook request' }, { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !vapidSubject ||
    !vapidPublicKey ||
    !vapidPrivateKey
  ) {
    return Response.json(
      { error: 'Notification service is not configured' },
      { status: 503 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.rpc('claim_order_notification', {
    p_order_id: orderId,
    p_webhook_secret: webhookSecret,
  });

  if (error) {
    const status = error.code === '42501' ? 401 : 500;
    return Response.json({ error: error.message }, { status });
  }
  if (!data) {
    return Response.json({ duplicate: true, sent: 0 });
  }

  const claimed = data as ClaimedNotification;
  const notification = buildOrderNotification(claimed.order);
  const serializedNotification = JSON.stringify(notification);
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  let sent = 0;
  const transientErrors: string[] = [];
  for (const subscription of claimed.subscriptions) {
    try {
      await webpush.sendNotification(subscription, serializedNotification, {
        TTL: 60 * 60,
        urgency: 'high',
      });
      sent += 1;
    } catch (cause) {
      const statusCode =
        typeof cause === 'object' && cause && 'statusCode' in cause
          ? Number(cause.statusCode)
          : 0;
      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from('order_push_subscriptions')
          .delete()
          .eq('id', subscription.id);
      } else {
        const message = cause instanceof Error ? cause.message : String(cause);
        transientErrors.push(message);
      }
    }
  }

  const failure =
    sent === 0 && transientErrors.length > 0
      ? transientErrors.join('; ').slice(0, 500)
      : null;
  const { error: completeError } = await supabase.rpc(
    'complete_order_notification',
    {
      p_error: failure,
      p_order_id: orderId,
      p_webhook_secret: webhookSecret,
    },
  );

  if (completeError) {
    return Response.json({ error: completeError.message }, { status: 500 });
  }

  return Response.json({ sent, subscriptionCount: claimed.subscriptions.length });
});
