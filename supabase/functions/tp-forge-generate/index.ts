// Submit a test-case generation job to testcase-forge and record the remote
// job id on the test plan. Persistence + status flip is handled by the
// client-polled `tp-forge-check` function (background waitUntil is unreliable
// for the ~25 min runtime of the Forge service).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FORGE_BASE = "https://testgenerator.qualixa.cortanexai.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("TESTGEN_API_KEY");
    if (!apiKey) return j({ error: "TESTGEN_API_KEY is not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return j({ error: "Unauthorized" }, 401);

    const { test_plan_id, settings: rawSettings } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const s = rawSettings ?? {};
    const cfg = {
      smoke: s.smoke !== false,
      regression: s.regression !== false,
      maxSmoke: Number.isFinite(s.maxSmoke) ? Number(s.maxSmoke) : 25,
      maxRegression: Number.isFinite(s.maxRegression) ? Number(s.maxRegression) : 100,
      prioritize: {
        businessValue: s?.prioritize?.businessValue !== false,
        criticalFlows: s?.prioritize?.criticalFlows !== false,
        highRisk: s?.prioritize?.highRisk !== false,
        frequentlyUsed: s?.prioritize?.frequentlyUsed !== false,
      },
      negativeTests: s.negativeTests !== false,
      boundaryCases: s.boundaryCases !== false,
      duplicateDetection: s.duplicateDetection !== false,
      language: typeof s.language === "string" ? s.language : "typescript",
    };
    if (!cfg.smoke && !cfg.regression) {
      return j({ error: "Select at least one test type (smoke or regression)." }, 400);
    }


    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, name, project_id, workspace_id, variables, plan_documents, description")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    const { data: docs } = await admin
      .from("test_plan_documents_v2")
      .select("slug, title, kind, content")
      .eq("test_plan_id", test_plan_id)
      .order("sort_order");

    const files: Array<{ filename: string; content: string; encoding?: string }> = [];

    for (const d of docs ?? []) {
      const name = `${(d.slug || d.title || "doc").replace(/[^a-zA-Z0-9._-]/g, "-")}.md`;
      files.push({ filename: name, content: String(d.content ?? "") });
    }

    const planDocs = Array.isArray((plan as any).plan_documents) ? (plan as any).plan_documents : [];
    if (planDocs.length) {
      const md = ["# Plan Documents", "", ...planDocs.map((d: any) =>
        `## ${d.name || "(untitled)"}\n${d.description || ""}\n\n${d.url ? `Source: ${d.url}` : ""}`,
      )].join("\n\n");
      files.push({ filename: "plan-documents.md", content: md });
    }

    const rawVars = Array.isArray((plan as any).variables) ? (plan as any).variables : [];
    const varSets = normaliseVariableSets(rawVars);
    if (varSets.length) {
      files.push({
        filename: "variables.json",
        content: JSON.stringify({ plan: plan.name, sets: varSets }, null, 2),
      });
      const md = ["# Variable Sets", ""];
      for (const s of varSets) {
        md.push(`## ${s.name}`);
        if (s.description) md.push(s.description);
        md.push("");
        md.push("| Key | Value |", "|---|---|");
        for (const v of s.variables) md.push(`| \`${v.key}\` | \`${v.value ?? ""}\` |`);
        md.push("");
      }
      files.push({ filename: "variables.md", content: md.join("\n") });
    }

    if (files.length === 0) {
      return j({ error: "No plan documents or variables to send. Add at least one." }, 400);
    }

    const submitRes = await fetch(`${FORGE_BASE}/v1/test-generations`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        files,
        options: { maxItemsPerUnit: 12, concurrency: 4, maxRepairRounds: 2 },
      }),
    });
    if (!submitRes.ok) {
      const t = await submitRes.text();
      return j({ error: `Forge submit failed (${submitRes.status}): ${t.slice(0, 500)}` }, 502);
    }
    const submit = await submitRes.json().catch(() => ({}));
    const jobId: string | undefined = submit?.id || submit?.job?.id || submit?.jobId;
    if (!jobId) return j({ error: "Forge did not return a job id", raw: submit }, 502);

    await admin.from("test_plans").update({
      ai_status: "running",
      ai_last_run_at: new Date().toISOString(),
      ai_job_ref: jobId,
    }).eq("id", test_plan_id);

    return j({ status: "accepted", jobId, message: "Generation started" }, 202);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function normaliseVariableSets(raw: any[]): Array<{ id: string; name: string; description: string; variables: Array<{ key: string; value: string }> }> {
  if (!raw?.length) return [];
  if (raw.every((r) => r && Array.isArray(r.variables))) {
    return raw.map((s: any) => ({
      id: String(s.id || crypto.randomUUID()),
      name: String(s.name || "Untitled Set"),
      description: String(s.description || ""),
      variables: (s.variables || []).filter((v: any) => v?.key).map((v: any) => ({
        key: String(v.key), value: String(v.value ?? ""),
      })),
    }));
  }
  return [{
    id: "legacy",
    name: "Default",
    description: "Migrated from legacy variables list",
    variables: raw.filter((v: any) => v?.key).map((v: any) => ({
      key: String(v.key), value: String(v.value ?? ""),
    })),
  }];
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
