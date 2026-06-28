import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { test_plan_id } = await req.json();
    if (!test_plan_id) {
      return new Response(JSON.stringify({ error: "test_plan_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase
      .from("test_plans")
      .update({ ai_status: "running", ai_last_run_at: new Date().toISOString() })
      .eq("id", test_plan_id);

    const { data: plan } = await supabase
      .from("test_plans")
      .select("*")
      .eq("id", test_plan_id)
      .single();

    if (!plan) throw new Error("Test plan not found");

    const { data: planDocs } = await supabase
      .from("test_plan_documents")
      .select("document_id, documents:document_id(name, filename, content, summary)")
      .eq("test_plan_id", test_plan_id);

    const docsContext = (planDocs || [])
      .map((d: any) => {
        const doc = d.documents;
        if (!doc) return "";
        return `### ${doc.name || doc.filename}\n${(doc.summary || "")}\n${(doc.content || "").slice(0, 6000)}`;
      })
      .filter(Boolean)
      .join("\n\n---\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a senior QA engineer. Generate a complete, structured test plan in JSON.
Return ONLY valid JSON matching this shape:
{
  "objective": string,
  "scope": string,
  "coverage_areas": string[],
  "test_cases": [
    { "title": string, "description": string, "priority": "high"|"medium"|"low",
      "type": "functional"|"integration"|"e2e"|"security"|"performance"|"regression",
      "preconditions": string, "steps": string[], "expected_result": string,
      "coverage_tags": string[] }
  ]
}
Generate 8-15 high quality test cases covering happy paths, edge cases, negative cases, and security.`;

    const userPrompt = `Test Plan: ${plan.name}
Description: ${plan.description || "N/A"}
Objective: ${plan.objective || "N/A"}
Scope: ${plan.scope || "N/A"}

Source Documents:
${docsContext || "(no documents attached — infer from plan name/description)"}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      await supabase.from("test_plans").update({ ai_status: "failed" }).eq("id", test_plan_id);
      return new Response(JSON.stringify({ error: `AI gateway: ${aiRes.status}` }), {
        status: aiRes.status === 429 || aiRes.status === 402 ? aiRes.status : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    // Update plan with objective/scope
    await supabase
      .from("test_plans")
      .update({
        objective: parsed.objective || plan.objective,
        scope: parsed.scope || plan.scope,
        ai_suggested: true,
      })
      .eq("id", test_plan_id);

    // Create test cases and link them
    const cases = Array.isArray(parsed.test_cases) ? parsed.test_cases : [];
    let created = 0;
    for (const tc of cases) {
      const priorityNum =
        tc.priority === "high" ? 1 : tc.priority === "low" ? 3 : 2;
      const { data: inserted, error: tcErr } = await supabase
        .from("test_cases")
        .insert({
          title: tc.title || "Untitled",
          description: tc.description || null,
          preconditions: tc.preconditions || null,
          expected_result: tc.expected_result || null,
          priority: priorityNum,
          status: "draft",
          ai_generated: true,
          ai_confidence: 0.85,
          coverage_tags: tc.coverage_tags || tc.type ? [tc.type, ...(tc.coverage_tags || [])] : null,
          created_by: plan.created_by,
          workspace_id: plan.workspace_id,
          project_id: plan.project_id,
        })
        .select("id")
        .single();

      if (!tcErr && inserted) {
        await supabase.from("test_plan_test_cases").insert({
          test_plan_id,
          test_case_id: inserted.id,
          added_by: plan.created_by,
        });
        // Insert steps
        if (Array.isArray(tc.steps)) {
          const stepRows = tc.steps.map((s: string, i: number) => ({
            test_case_id: inserted.id,
            step_number: i + 1,
            action: s,
            expected_result: i === tc.steps.length - 1 ? tc.expected_result || "" : "",
          }));
          if (stepRows.length) await supabase.from("test_case_steps").insert(stepRows);
        }
        created++;
      }
    }

    // Snapshot a version
    const nextVersion = (plan.current_version || 1) + (created > 0 ? 1 : 0);
    if (created > 0) {
      await supabase.from("test_plan_versions").insert({
        test_plan_id,
        version: nextVersion,
        snapshot: parsed,
        change_summary: `AI generated ${created} test case(s)`,
        created_by: plan.created_by,
      });
      await supabase
        .from("test_plans")
        .update({ ai_status: "ready", current_version: nextVersion })
        .eq("id", test_plan_id);
    } else {
      await supabase
        .from("test_plans")
        .update({ ai_status: "ready" })
        .eq("id", test_plan_id);
    }

    return new Response(
      JSON.stringify({ success: true, created, version: nextVersion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
