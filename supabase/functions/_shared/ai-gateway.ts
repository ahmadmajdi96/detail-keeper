// Minimal Lovable AI Gateway helper for edge functions.
// Uses OpenAI-compatible chat completions. JSON mode supported via response_format.

const BASE = "https://ai.gateway.lovable.dev/v1";

export interface CallOptions {
  model?: string;
  system?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  json?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export async function callAi(prompt: string, opts: CallOptions = {}): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("Missing LOVABLE_API_KEY");

  const messages = opts.messages ?? [];
  if (!messages.length) {
    if (opts.system) messages.push({ role: "system", content: opts.system });
    messages.push({ role: "user", content: prompt });
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? "google/gemini-3-flash-preview",
    messages,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.max_tokens !== undefined) body.max_tokens = opts.max_tokens;
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "edge-fetch",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("AI rate limited, please retry shortly");
    if (res.status === 402) throw new Error("AI credits exhausted — top up in Settings → Plans & credits");
    throw new Error(`AI gateway ${res.status}: ${text}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export async function callAiJson<T = unknown>(prompt: string, opts: CallOptions = {}): Promise<T> {
  const text = await callAi(prompt, { ...opts, json: true });
  // Some models wrap JSON in ```json fences — strip if present.
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  return JSON.parse(cleaned) as T;
}
