// Shared helpers for verifying signed OAuth state and rendering the callback popup HTML.
const SIGNING_SECRET = Deno.env.get("JOB_WORKER_SECRET")!;

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export type StatePayload = {
  userId: string;
  workspace_id: string;
  project_id: string | null;
  provider: "github" | "jira";
  origin: string;
  nonce: string;
  exp: number;
};

export async function verifyState(state: string): Promise<StatePayload> {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) throw new Error("malformed_state");
  const expected = await sign(payloadB64);
  if (expected !== sig) throw new Error("bad_signature");
  const parsed = JSON.parse(b64urlDecode(payloadB64)) as StatePayload;
  if (parsed.exp < Date.now()) throw new Error("expired_state");
  return parsed;
}

export function popupResponseHtml(opts: {
  ok: boolean;
  origin: string;
  provider: string;
  message?: string;
}): Response {
  const payload = JSON.stringify({
    type: "qualixa:oauth",
    ok: opts.ok,
    provider: opts.provider,
    message: opts.message ?? "",
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${opts.provider} OAuth</title></head>
<body style="background:#05080f;color:#dde8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
  <div style="font-size:18px;margin-bottom:8px">${opts.ok ? "Connected!" : "Connection failed"}</div>
  <div style="font-size:12px;color:#7a96b0">${opts.message ?? "You can close this window."}</div>
</div>
<script>
  (function(){
    try {
      var msg = ${payload};
      if (window.opener) {
        window.opener.postMessage(msg, ${JSON.stringify(opts.origin)});
      }
    } catch (e) {}
    setTimeout(function(){ window.close(); }, 1200);
  })();
</script>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
