// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace("Bearer ", "");
    if (!jwt) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // caller identity
    const asCaller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: userRes } = await asCaller.auth.getUser();
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: cors });

    const { org_id } = await req.json();
    if (!org_id) return new Response(JSON.stringify({ error: "org_id required" }), { status: 400, headers: cors });

    // membership check via service role
    const admin = createClient(supabaseUrl, svcKey);
    const { data: org } = await admin.from("organizations").select("*").eq("id", org_id).maybeSingle();
    if (!org) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });

    let allowed = org.owner_id === user.id;
    if (!allowed) {
      const { data: m } = await admin.from("organization_members").select("role").eq("org_id", org_id).eq("user_id", user.id).maybeSingle();
      allowed = !!m && ["owner", "security_admin", "billing_admin"].includes(m.role);
    }
    if (!allowed) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });

    // gather
    const { data: workspaces } = await admin.from("workspaces").select("*").eq("organization_id", org_id);
    const wsIds = (workspaces || []).map((w: any) => w.id);

    const [members, invitations, projects, ssoConns, subscriptions] = await Promise.all([
      admin.from("organization_members").select("*").eq("org_id", org_id),
      admin.from("workspace_invitations").select("*").in("workspace_id", wsIds.length ? wsIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("projects").select("*").in("workspace_id", wsIds.length ? wsIds : ["00000000-0000-0000-0000-000000000000"]),
      admin.from("sso_connections").select("id,provider,display_name,domains,enabled,created_at").eq("org_id", org_id),
      admin.from("subscriptions").select("*").eq("org_id", org_id),
    ]);

    const projIds = (projects.data || []).map((p: any) => p.id);
    const inProjects = projIds.length ? projIds : ["00000000-0000-0000-0000-000000000000"];

    const [documents, testPlans, testCases, testCycles, cycleRuns, defects, releases, executions] = await Promise.all([
      admin.from("documents").select("id,project_id,filename,type,status,created_at").in("project_id", inProjects),
      admin.from("test_plans").select("*").in("project_id", inProjects),
      admin.from("test_cases").select("*").in("project_id", inProjects),
      admin.from("test_cycles").select("*").in("project_id", inProjects),
      admin.from("cycle_runs").select("*").in("project_id", inProjects),
      admin.from("defects").select("*").in("project_id", inProjects),
      admin.from("releases").select("*").in("project_id", inProjects),
      admin.from("test_executions").select("*").in("test_case_id", (testCases as any)?.data?.map((x: any) => x.id) || ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const archive = {
      exported_at: new Date().toISOString(),
      exported_by: { id: user.id, email: user.email },
      organization: org,
      subscriptions: subscriptions.data || [],
      members: members.data || [],
      sso_connections: ssoConns.data || [],
      workspaces: workspaces || [],
      invitations: invitations.data || [],
      projects: projects.data || [],
      documents: documents.data || [],
      test_plans: testPlans.data || [],
      test_cases: testCases.data || [],
      test_cycles: testCycles.data || [],
      cycle_runs: cycleRuns.data || [],
      test_executions: executions.data || [],
      defects: defects.data || [],
      releases: releases.data || [],
    };

    // audit log
    try {
      await admin.rpc("log_audit", {
        _org_id: org_id, _workspace_id: null,
        _action: "org.export", _entity_kind: "organization", _entity_id: org_id,
        _meta: { at: new Date().toISOString() },
      });
    } catch { /* ignore */ }

    return new Response(JSON.stringify(archive), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="qualixa-org-${org.slug || org_id}.json"`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: cors });
  }
});
