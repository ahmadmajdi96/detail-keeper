import { corsHeaders } from '../_shared/cors.ts';
import { gatewayFetch, type PaddleEnv } from '../_shared/paddle.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { priceId, environment } = await req.json();
    const env: PaddleEnv = environment === 'live' ? 'live' : 'sandbox';
    if (!priceId) throw new Error('priceId is required');
    const resp = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(priceId)}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(`Paddle error: ${JSON.stringify(data)}`);
    if (!data.data?.length) throw new Error(`Price not found: ${priceId}`);
    return new Response(JSON.stringify({ paddleId: data.data[0].id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[get-paddle-price] error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
