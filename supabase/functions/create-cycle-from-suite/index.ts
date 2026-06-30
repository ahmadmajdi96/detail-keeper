import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const { cycle_id, suite_id, test_plan_id } = await req.json();
    if (!cycle_id) throw new Error("cycle_id required");
    const { data: cycle } = await sb.from("test_cycles").select("*").eq("id", cycle_id).single();
    if (!cycle) throw new Error("cycle not found");

    // Pick case ids from suite OR test plan
    let caseIds: string[] = [];
    if (suite_id) {
      const { data } = await sb.from("suite_test_cases").select("test_case_id").eq("suite_id", suite_id);
      caseIds = (data || []).map((d: any) => d.test_case_id);
    } else if (test_plan_id || cycle.test_plan_id) {
      const tpid = test_plan_id || cycle.test_plan_id;
      const { data } = await sb.from("test_plan_test_cases").select("test_case_id").eq("test_plan_id", tpid);
      caseIds = (data || []).map((d: any) => d.test_case_id);
    }
    if (!caseIds.length) {
      return new Response(JSON.stringify({ ok: true, run_id: null, items: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: run, error: rErr } = await sb.from("cycle_runs").insert({
      cycle_id, project_id: cycle.project_id,
      name: `Run ${new Date().toISOString().slice(0,16)}`, status: "planned",
    }).select("id").single();
    if (rErr) throw rErr;

    const { data: cases } = await sb.from("test_cases").select("id,version").in("id", caseIds);
    const rows = (cases || []).map((c: any) => ({
      run_id: run.id, cycle_id, test_case_id: c.id,
      test_case_version: c.version || 1, status: "not_run",
    }));
    if (rows.length) await sb.from("cycle_run_items").insert(rows);

    return new Response(JSON.stringify({ ok: true, run_id: run.id, items: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
