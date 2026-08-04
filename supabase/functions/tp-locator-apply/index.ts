// Apply (or reject) AI Locator Intelligence recommendations.
// Applying rewrites the matching locator expression inside the plan's spec files.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return j({ error: "Unauthorized" }, 401);

    const { analysis_id, finding_ids, action } = await req.json();
    if (!analysis_id || !action) return j({ error: "analysis_id and action required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: analysis } = await admin.from("locator_analyses").select("*").eq("id", analysis_id).maybeSingle();
    if (!analysis) return j({ error: "Analysis not found" }, 404);

    const findings: any[] = Array.isArray((analysis as any).findings) ? (analysis as any).findings : [];
    const wanted = Array.isArray(finding_ids) && finding_ids.length
      ? new Set(finding_ids.map(String))
      : null; // null = all actionable

    const selected = findings.filter((f) =>
      (wanted ? wanted.has(f.id) : f.health !== "healthy") &&
      f.status === "pending" &&
      (action === "reject" || !!f.recommendation)
    );

    if (action === "reject") {
      for (const f of selected) f.status = "rejected";
      await admin.from("locator_analyses").update({ findings }).eq("id", analysis_id);
      return j({ rejected: selected.length });
    }

    // Apply: rewrite spec content.
    const { data: specs } = await admin
      .from("test_plan_specs")
      .select("id, filename, content")
      .eq("test_plan_id", (analysis as any).test_plan_id);

    const byFile = new Map<string, any>();
    for (const s of (specs ?? []) as any[]) byFile.set(s.filename, s);

    let applied = 0;
    const dirty = new Set<string>();
    for (const f of selected) {
      const spec = byFile.get(f.file);
      if (!spec || !f.recommendation) continue;
      if (!String(spec.content).includes(f.raw)) continue;
      spec.content = String(spec.content).split(f.raw).join(f.recommendation);
      f.status = "applied";
      f.applied_at = new Date().toISOString();
      dirty.add(spec.id);
      applied++;
    }

    for (const id of dirty) {
      const spec = [...byFile.values()].find((s) => s.id === id);
      await admin.from("test_plan_specs").update({ content: spec.content }).eq("id", id);
    }

    const totals = { ...((analysis as any).totals ?? {}), fixes: (Number((analysis as any).applied_count) || 0) + applied };
    const remainingBroken = findings.filter((f) => f.health === "broken" && f.status !== "applied").length;
    const remainingWeak = findings.filter((f) => f.health === "weak" && f.status !== "applied").length;

    await admin.from("locator_analyses").update({
      findings,
      totals,
      applied_count: totals.fixes,
      verdict: remainingBroken > 0 ? "blocked" : remainingWeak > 0 ? "warning" : "ready",
    }).eq("id", analysis_id);

    return j({ applied, verdict: remainingBroken > 0 ? "blocked" : remainingWeak > 0 ? "warning" : "ready" });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
