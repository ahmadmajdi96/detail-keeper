// Paddle webhook — updates the org's subscription row, logs audit, sends confirmation
// email, notifies org admins in-app and via Slack (if connected).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, planKeyFromPriceId, type PaddleEnv } from '../_shared/paddle.ts';

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }
  return _supabase;
}

async function resolveOrgForUser(userId: string): Promise<string | null> {
  const sb = getSupabase();
  const { data: prof } = await sb.from('profiles').select('last_organization_id').eq('id', userId).maybeSingle();
  if (prof?.last_organization_id) return prof.last_organization_id as string;
  const { data: owned } = await sb.from('organizations').select('id').eq('owner_id', userId).limit(1).maybeSingle();
  if (owned?.id) return owned.id as string;
  const { data: mem } = await sb.from('organization_members').select('org_id').eq('user_id', userId).limit(1).maybeSingle();
  return mem?.org_id ?? null;
}

async function notifyOrgAdmins(orgId: string, type: string, title: string, message: string, data: Record<string, unknown>) {
  const sb = getSupabase();
  const { data: members } = await sb
    .from('organization_members')
    .select('user_id, role')
    .eq('org_id', orgId)
    .in('role', ['owner', 'billing_admin', 'admin']);
  const rows = (members ?? []).map((m: any) => ({
    user_id: m.user_id, type, title, message, data,
  }));
  if (rows.length) await sb.from('notifications').insert(rows);
}

async function postSlack(orgId: string, text: string) {
  const sb = getSupabase();
  const { data: conn } = await sb
    .from('integration_connections')
    .select('config')
    .eq('org_id', orgId)
    .eq('provider', 'slack')
    .eq('status', 'connected')
    .maybeSingle();
  const webhook = (conn?.config as any)?.webhook_url || (conn?.config as any)?.incoming_webhook_url;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (e) { console.warn('[payments-webhook] slack post failed', e); }
}

async function sendConfirmationEmail(userId: string, planName: string) {
  const sb = getSupabase();
  const { data: prof } = await sb.from('profiles').select('email, name').eq('id', userId).maybeSingle();
  if (!prof?.email) return;
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return; // graceful skip
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Qualixa <no-reply@qualixa.dev>',
        to: [prof.email],
        subject: `Welcome to ${planName} 🎉`,
        html: `<p>Hi ${prof.name || 'there'},</p><p>Thanks for subscribing to <strong>${planName}</strong>. Your new features are unlocked immediately.</p><p>— The Qualixa team</p>`,
      }),
    });
  } catch (e) { console.warn('[payments-webhook] email send failed', e); }
}

async function handleSubscriptionCreatedOrUpdated(data: any, env: PaddleEnv, eventType: string) {
  const { id: paddleSubId, customerId, items, status, currentBillingPeriod, customData, scheduledChange } = data;
  const userId = customData?.userId;
  if (!userId) { console.error('[payments-webhook] missing customData.userId'); return; }

  const item = items?.[0];
  const priceExternalId = item?.price?.importMeta?.externalId as string | undefined;
  const planKey = planKeyFromPriceId(priceExternalId);
  if (!planKey) {
    console.warn('[payments-webhook] unknown price external id', priceExternalId);
    return;
  }

  const orgId = await resolveOrgForUser(userId);
  if (!orgId) { console.error('[payments-webhook] no org for user', userId); return; }

  const sb = getSupabase();
  const { data: existing } = await sb
    .from('subscriptions').select('plan_key').eq('org_id', orgId).maybeSingle();
  const previousPlan = existing?.plan_key as string | null;

  const row = {
    org_id: orgId,
    plan_key: planKey,
    status,
    paddle_subscription_id: paddleSubId,
    paddle_customer_id: customerId,
    paddle_price_id: priceExternalId,
    environment: env,
    current_period_start: currentBillingPeriod?.startsAt ?? new Date().toISOString(),
    current_period_end: currentBillingPeriod?.endsAt ?? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    cancel_at_period_end: scheduledChange?.action === 'cancel',
    updated_at: new Date().toISOString(),
  };
  const { error: upErr } = await sb.from('subscriptions').upsert(row, { onConflict: 'org_id' });
  if (upErr) { console.error('[payments-webhook] upsert error', upErr); return; }

  const { data: plan } = await sb.from('plans').select('name').eq('key', planKey).maybeSingle();
  const planName = plan?.name || planKey;

  if (eventType === 'subscription.created' || previousPlan !== planKey) {
    const isUpgrade = previousPlan && previousPlan !== planKey;
    const title = isUpgrade ? `Plan changed to ${planName}` : `Subscribed to ${planName}`;
    const message = isUpgrade
      ? `Your organization switched from ${previousPlan} to ${planName}. New entitlements apply immediately.`
      : `Your ${planName} subscription is active. Enjoy your new features!`;
    await notifyOrgAdmins(orgId, 'billing', title, message, { plan_key: planKey, paddle_subscription_id: paddleSubId });
    await postSlack(orgId, `:tada: *${title}* — ${message}`);
    if (eventType === 'subscription.created') await sendConfirmationEmail(userId, planName);
  }
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const paddleSubId = data.id;
  const sb = getSupabase();
  // Immediate downgrade: set plan_key='free' and status='canceled'
  const { data: sub } = await sb
    .from('subscriptions')
    .select('org_id, plan_key')
    .eq('paddle_subscription_id', paddleSubId)
    .eq('environment', env)
    .maybeSingle();
  if (!sub) return;

  await sb.from('subscriptions')
    .update({
      plan_key: 'free',
      status: 'canceled',
      cancel_at_period_end: false,
      current_period_end: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', paddleSubId)
    .eq('environment', env);

  await notifyOrgAdmins(sub.org_id as string, 'billing', 'Subscription canceled',
    `Your ${sub.plan_key} plan was canceled and downgraded to Free immediately.`,
    { paddle_subscription_id: paddleSubId });
  await postSlack(sub.org_id as string, `:warning: Subscription canceled — downgraded to Free.`);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as PaddleEnv;
  try {
    const event = await verifyWebhook(req, env);
    console.log('[payments-webhook]', env, event.eventType);
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
        await handleSubscriptionCreatedOrUpdated(event.data, env, 'subscription.created');
        break;
      case EventName.SubscriptionUpdated:
        await handleSubscriptionCreatedOrUpdated(event.data, env, 'subscription.updated');
        break;
      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(event.data, env);
        break;
      default:
        console.log('[payments-webhook] unhandled', event.eventType);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[payments-webhook] error', e);
    return new Response('Webhook error', { status: 400 });
  }
});
