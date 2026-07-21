// Creates a Paddle customer portal session for the caller's org subscription.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getPaddleClient, type PaddleEnv } from '../_shared/paddle.ts';

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims } = await sb.auth.getClaims(auth.replace('Bearer ', ''));
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: prof } = await admin.from('profiles').select('last_organization_id').eq('id', userId).maybeSingle();
    const orgId = prof?.last_organization_id;
    if (!orgId) return json({ error: 'no organization' }, 400);

    const { data: sub } = await admin.from('subscriptions')
      .select('paddle_customer_id, paddle_subscription_id, environment')
      .eq('org_id', orgId).maybeSingle();
    if (!sub?.paddle_customer_id) return json({ error: 'no_paid_subscription' }, 400);

    const paddle = getPaddleClient((sub.environment as PaddleEnv) || 'sandbox');
    const session: any = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id as string,
      sub.paddle_subscription_id ? [sub.paddle_subscription_id as string] : [],
    );
    const url = session?.urls?.general?.overview || session?.urls?.subscriptions?.[0]?.cancelSubscription || session?.urls?.[0];
    return json({ url });
  } catch (e) {
    console.error('[paddle-portal] error', e);
    return json({ error: (e as Error).message }, 500);
  }
});
