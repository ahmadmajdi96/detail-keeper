import { Environment, Paddle, EventName } from 'npm:@paddle/paddle-node-sdk';

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export { EventName };
export type PaddleEnv = 'sandbox' | 'live';

const GATEWAY_BASE_URL = 'https://connector-gateway.lovable.dev/paddle';

export function getConnectionApiKey(env: PaddleEnv): string {
  return env === 'sandbox'
    ? getEnv('PADDLE_SANDBOX_API_KEY')
    : getEnv('PADDLE_LIVE_API_KEY');
}

export function getPaddleClient(env: PaddleEnv): Paddle {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');
  return new Paddle(connectionApiKey, {
    environment: GATEWAY_BASE_URL as unknown as Environment,
    customHeaders: {
      'X-Connection-Api-Key': connectionApiKey,
      'Lovable-API-Key': lovableApiKey,
    },
  });
}

export async function gatewayFetch(env: PaddleEnv, path: string, init?: RequestInit): Promise<Response> {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');
  return fetch(`${GATEWAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Connection-Api-Key': connectionApiKey,
      'Lovable-API-Key': lovableApiKey,
      ...init?.headers,
    },
  });
}

export function getWebhookSecret(env: PaddleEnv): string {
  return env === 'sandbox'
    ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');
}

export async function verifyWebhook(req: Request, env: PaddleEnv) {
  const signature = req.headers.get('paddle-signature');
  const body = await req.text();
  const secret = getWebhookSecret(env);
  if (!signature || !body) throw new Error('Missing signature or body');
  const paddle = getPaddleClient(env);
  return await paddle.webhooks.unmarshal(body, secret, signature);
}

// Map a Paddle price external ID to our internal plan_key
export function planKeyFromPriceId(priceExternalId: string | null | undefined): string | null {
  if (!priceExternalId) return null;
  if (priceExternalId.startsWith('individual_starter')) return 'individual_starter';
  if (priceExternalId.startsWith('individual_pro')) return 'individual_pro';
  if (priceExternalId.startsWith('individual_grow')) return 'individual_grow';
  if (priceExternalId.startsWith('enterprise_small')) return 'enterprise_small';
  if (priceExternalId.startsWith('enterprise_mid')) return 'enterprise_mid';
  return null;
}
