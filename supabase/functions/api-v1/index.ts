// Lightweight REST API accepting Qualixa API keys (Authorization: Bearer qxa_...)
// Verifies the key against api_keys.key_hash, enforces scopes, updates last_used_at,
// and performs read/write actions as the org via service role (RLS-scoped by org_id).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function scopeAllows(scopes: string[], needed: string): boolean {
  if (scopes.includes("*") || scopes.includes("admin:*")) return true;
  if (scopes.includes(needed)) return true;
  const [ns] = needed.split(":");
  return scopes.includes(`${ns}:*`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("qxa_")) return jsonResp({ error: "Missing or invalid API key" }, 401);

  const hash = await sha256Hex(token);
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const { data: key } = await admin.from("api_keys").select("*")
    .eq("key_hash", hash).is("revoked_at", null).maybeSingle();
  if (!key) return jsonResp({ error: "Invalid or revoked API key" }, 401);

  // Fire-and-forget last_used_at update
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(() => {});

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/api-v1/, "").replace(/^\/+/, "");
  const parts = path.split("/").filter(Boolean);

  try {
    // GET /projects
    if (req.method === "GET" && parts[0] === "projects") {
      if (!scopeAllows(key.scopes, "projects:read")) return jsonResp({ error: "Missing scope projects:read" }, 403);
      const { data, error } = await admin.from("projects").select("id,name,status,workspace_id,created_at")
        .in("workspace_id",
          (await admin.from("workspaces").select("id").eq("organization_id", key.org_id)).data?.map((w: any) => w.id) || []);
      if (error) return jsonResp({ error: error.message }, 400);
      return jsonResp({ items: data });
    }

    // GET /defects  ?project_id=
    if (req.method === "GET" && parts[0] === "defects") {
      if (!scopeAllows(key.scopes, "defects:read")) return jsonResp({ error: "Missing scope defects:read" }, 403);
      const pid = url.searchParams.get("project_id");
      let q = admin.from("defects").select("id,title,status,severity,priority,project_id,created_at").order("created_at", { ascending: false }).limit(200);
      if (pid) q = q.eq("project_id", pid);
      const { data, error } = await q;
      if (error) return jsonResp({ error: error.message }, 400);
      return jsonResp({ items: data });
    }

    // POST /defects
    if (req.method === "POST" && parts[0] === "defects") {
      if (!scopeAllows(key.scopes, "defects:write")) return jsonResp({ error: "Missing scope defects:write" }, 403);
      const body = await req.json().catch(() => ({}));
      const { project_id, title, description, severity, priority } = body || {};
      if (!project_id || !title) return jsonResp({ error: "project_id and title required" }, 400);
      const { data, error } = await admin.from("defects").insert({
        project_id, title, description, severity, priority,
        reported_by: key.created_by, status: "open",
      }).select().single();
      if (error) return jsonResp({ error: error.message }, 400);
      return jsonResp({ defect: data }, 201);
    }

    // GET /test-plans ?project_id=
    if (req.method === "GET" && (parts[0] === "test-plans" || parts[0] === "testplans")) {
      if (!scopeAllows(key.scopes, "testplans:read")) return jsonResp({ error: "Missing scope testplans:read" }, 403);
      const pid = url.searchParams.get("project_id");
      let q = admin.from("test_plans").select("id,name,status,project_id,created_at").order("created_at", { ascending: false }).limit(200);
      if (pid) q = q.eq("project_id", pid);
      const { data, error } = await q;
      if (error) return jsonResp({ error: error.message }, 400);
      return jsonResp({ items: data });
    }

    // GET /test-cases ?project_id=
    if (req.method === "GET" && (parts[0] === "test-cases" || parts[0] === "testcases")) {
      if (!scopeAllows(key.scopes, "testcases:read")) return jsonResp({ error: "Missing scope testcases:read" }, 403);
      const pid = url.searchParams.get("project_id");
      let q = admin.from("test_cases").select("id,title,status,priority,project_id,created_at").order("created_at", { ascending: false }).limit(200);
      if (pid) q = q.eq("project_id", pid);
      const { data, error } = await q;
      if (error) return jsonResp({ error: error.message }, 400);
      return jsonResp({ items: data });
    }

    // GET /me — verify key + return scopes
    if (req.method === "GET" && (parts.length === 0 || parts[0] === "me")) {
      return jsonResp({
        ok: true, key_name: key.name, key_prefix: key.key_prefix, scopes: key.scopes,
        org_id: key.org_id, workspace_id: key.workspace_id,
      });
    }

    return jsonResp({ error: "Not found", path }, 404);
  } catch (e) {
    return jsonResp({ error: (e as Error).message }, 500);
  }
});
