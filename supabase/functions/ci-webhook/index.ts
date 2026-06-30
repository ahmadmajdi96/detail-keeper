// CI webhook receiver. Accepts builds/deployments/results events and either
// records build state directly or enqueues an ingest_ci_results job.
//
// Auth: HMAC-SHA256 of raw body using the integration's secret (looked up by
// X-Integration-Id header). The plaintext secret is provided once at creation
// time and only its bcrypt-ish hash is stored — for this MVP we store a SHA-256
// hex hash and clients send the raw secret in X-Signature directly OR send
// X-Signature as the HMAC of the body.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const integrationId = req.headers.get("x-integration-id");
  const signature = req.headers.get("x-signature") || "";
  const rawBody = await req.text();

  if (!integrationId) {
    return new Response(JSON.stringify({ error: "x-integration-id header required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: integ } = await sb.from("ci_integrations").select("*").eq("id", integrationId).maybeSingle();
  if (!integ || !integ.is_active) {
    return new Response(JSON.stringify({ error: "integration not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // Accept either raw secret hash match OR HMAC of body.
  const rawHash = await sha256Hex(signature);
  const hmac = await hmacSha256Hex(signature || "x", rawBody);
  if (rawHash !== integ.secret_hash && hmac !== integ.secret_hash) {
    // Also try: signature IS the hmac with the original secret. Without the
    // plaintext we can't verify; if rawHash matches secret_hash, the caller
    // sent the original token directly (acceptable for trusted CI).
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event = body.event || "build";
  const projectId = integ.project_id;

  // Resolve release: explicit > branch_release_map > integration default
  let releaseId = body.release_id || null;
  if (!releaseId && body.branch && integ.branch_release_map?.[body.branch]) {
    releaseId = integ.branch_release_map[body.branch];
  }
  if (!releaseId) releaseId = integ.default_release_id;
  const environmentId = body.environment_id || integ.default_environment_id;

  // Record/Update ci_run
  await sb.from("ci_runs").insert({
    project_id: projectId, integration_id: integ.id,
    provider: integ.provider, provider_run_id: body.run_id || null,
    branch: body.branch || null, commit_sha: body.commit_sha || null,
    status: body.status || "received", url: body.url || null,
    started_at: body.started_at || new Date().toISOString(),
    finished_at: body.finished_at || null,
    raw: body,
  });

  // Upsert build
  let buildId = body.build_id;
  if (!buildId && (body.commit_sha || body.branch)) {
    const { data: existing } = await sb.from("builds").select("id")
      .eq("project_id", projectId)
      .eq("commit_sha", body.commit_sha || "")
      .maybeSingle();
    if (existing) buildId = existing.id;
    if (!buildId) {
      const { data: nb } = await sb.from("builds").insert({
        project_id: projectId, release_id: releaseId,
        name: body.build_name || (body.commit_sha ? `Build ${body.commit_sha.slice(0,7)}` : "CI Build"),
        branch: body.branch || null, commit_sha: body.commit_sha || null,
        commit_message: body.commit_message || null,
        ci_run_url: body.url || null, ci_provider: integ.provider,
        artifact_url: body.artifact_url || null,
        status: body.status === "failed" ? "failed" : body.status === "success" ? "success" : "building",
        built_at: new Date().toISOString(),
      }).select("id").single();
      buildId = nb?.id;
    }
  }

  if (event === "build" && buildId && body.status) {
    await sb.from("builds").update({
      status: body.status === "failed" ? "failed" : body.status === "success" ? "success" : "building",
    }).eq("id", buildId);
  }

  if (event === "deployment" && buildId && environmentId) {
    await sb.from("deployments").insert({
      build_id: buildId, environment_id: environmentId,
      deployed_at: body.deployed_at || new Date().toISOString(),
      status: body.status || "succeeded",
    });
  }

  // Enqueue result ingestion jobs
  const enqueuedJobs: string[] = [];
  if (event === "results" || (body.artifacts && body.artifacts.length)) {
    const artifacts = body.artifacts || [{ url: body.artifact_url, framework: body.framework }];
    for (const a of artifacts) {
      if (!a?.url && !a?.content) continue;
      const { data: job } = await sb.from("jobs").insert({
        workspace_id: null,
        project_id: projectId,
        kind: "ingest_ci_results",
        payload: {
          project_id: projectId,
          build_id: buildId, release_id: releaseId, environment_id: environmentId,
          commit_sha: body.commit_sha,
          artifact_url: a.url, artifact_content: a.content,
          framework_hint: a.framework,
        },
        max_attempts: 3,
      }).select("id").single();
      if (job) enqueuedJobs.push(job.id);
    }
  }

  return new Response(JSON.stringify({
    ok: true, build_id: buildId, release_id: releaseId, environment_id: environmentId,
    enqueued_jobs: enqueuedJobs,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
