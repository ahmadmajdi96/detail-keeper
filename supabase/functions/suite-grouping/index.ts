import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { projectId, rules } = await req.json();
    if (!projectId) return json({ error: "projectId is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the caller can reach this project (RLS-scoped client).
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: proj } = await userClient
      .from("projects")
      .select("id, name")
      .eq("id", projectId)
      .maybeSingle();
    if (!proj) return json({ error: "Project not found or access denied" }, 403);

    const { data: cases } = await admin
      .from("test_cases")
      .select("id, title, description, coverage_tags, priority, suite_id")
      .eq("project_id", projectId)
      .limit(400);

    if (!cases?.length) return json({ error: "No test cases to group" }, 400);

    const { data: suites } = await admin
      .from("test_suites")
      .select("id, name")
      .eq("project_id", projectId);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "AI is not configured" }, 500);

    const r = rules ?? {};
    const instructions = [
      r.granularity ? `Grouping granularity: ${r.granularity}.` : "",
      r.maxSuites ? `Produce at most ${r.maxSuites} suites.` : "",
      r.strategy ? `Group primarily by: ${r.strategy}.` : "",
      r.reuseExisting !== false && suites?.length
        ? `Reuse these existing suite names when they fit: ${suites.map((s: any) => s.name).join(", ")}.`
        : "",
      r.customInstructions ? `Extra rules: ${r.customInstructions}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const payload = cases.map((c: any) => ({
      id: c.id,
      title: c.title,
      tags: c.coverage_tags ?? [],
    }));

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a QA architect. Group test cases into functional test suites. " +
              "Respond ONLY with JSON of the shape " +
              '{"assignments":[{"id":"<test case id>","suite":"<suite name>","reason":"<short reason>"}]}. ' +
              "Every provided test case id must appear exactly once.",
          },
          {
            role: "user",
            content: `Project: ${proj.name}\n${instructions}\n\nTest cases:\n${JSON.stringify(payload)}`,
          },
        ],
      }),
    });

    if (res.status === 429) return json({ error: "AI rate limit reached, try again shortly" }, 429);
    if (res.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (!res.ok) return json({ error: `AI request failed (${res.status})` }, 500);

    const out = await res.json();
    const text: string = out?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: "AI returned an unreadable response" }, 500);

    const parsed = JSON.parse(match[0]);
    const assignments: { id: string; suite: string; reason?: string }[] = parsed.assignments ?? [];
    const valid = assignments.filter((a) => a?.id && a?.suite && cases.some((c: any) => c.id === a.id));
    if (!valid.length) return json({ error: "AI produced no usable assignments" }, 500);

    // Persist as proposals — nothing is finalised until the user reviews them.
    for (const a of valid) {
      await admin
        .from("test_cases")
        .update({
          proposed_suite_name: a.suite.trim(),
          suite_assignment_status: "proposed",
        })
        .eq("id", a.id);
    }

    await admin
      .from("projects")
      .update({ suite_grouping_rules: r })
      .eq("id", projectId);

    return json({ proposed: valid.length, assignments: valid });
  } catch (e) {
    console.error("[suite-grouping]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
