import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userRes, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userRes?.user) return json({ error: "unauthorized" }, 401);
    const user = userRes.user;

    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") return json({ error: "Missing token" }, 400);

    const admin = createClient(url, service);

    const { data: inv, error: invErr } = await admin
      .from("workspace_invitations")
      .select("id,workspace_id,email,role,status,expires_at")
      .eq("token", token)
      .maybeSingle();
    if (invErr) return json({ error: invErr.message }, 500);
    if (!inv) return json({ error: "Invitation not found" }, 404);
    if (inv.status === "accepted") return json({ error: "Invitation already used" }, 409);
    if (inv.status !== "pending") return json({ error: `Invitation ${inv.status}` }, 409);
    if (new Date(inv.expires_at).getTime() < Date.now()) {
      await admin.from("workspace_invitations").update({ status: "expired" }).eq("id", inv.id);
      return json({ error: "Invitation expired" }, 410);
    }

    const userEmail = (user.email || "").toLowerCase();
    if (userEmail !== inv.email.toLowerCase()) {
      return json({
        error: `This invitation is for ${inv.email}. Sign in with that email to accept.`,
      }, 403);
    }

    // Fetch workspace for response
    const { data: ws } = await admin
      .from("workspaces")
      .select("id,name")
      .eq("id", inv.workspace_id)
      .maybeSingle();

    // Insert membership (service role bypasses RLS)
    const { error: memErr } = await admin
      .from("workspace_members")
      .insert({ workspace_id: inv.workspace_id, user_id: user.id, role: inv.role });
    if (memErr && !String(memErr.message).toLowerCase().includes("duplicate")) {
      return json({ error: memErr.message }, 500);
    }

    await admin
      .from("workspace_invitations")
      .update({ status: "accepted" })
      .eq("id", inv.id);

    return json({
      ok: true,
      workspace_id: inv.workspace_id,
      workspace_name: ws?.name || "Workspace",
      role: inv.role,
    });
  } catch (e) {
    return json({ error: (e as Error).message || "Internal error" }, 500);
  }
});
