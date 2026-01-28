import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    const { endpointId, testPlanId, baseUrl, method, path, headers, body, assertions } = await req.json();

    if (!endpointId || !baseUrl || !method || !path) {
      return new Response(
        JSON.stringify({ error: "Endpoint ID, base URL, method, and path are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `${baseUrl}${path}`;
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(headers || {}),
    };

    const startTime = Date.now();
    let responseStatus = 0;
    let responseHeaders: Record<string, string> = {};
    let responseBody = "";
    let status = "passed";
    const assertionResults: { assertion: string; passed: boolean; actual?: string }[] = [];

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: requestHeaders,
      };

      if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
        fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const responseTime = Date.now() - startTime;

      responseStatus = response.status;
      responseHeaders = Object.fromEntries(response.headers.entries());
      responseBody = await response.text();

      // Run assertions
      if (assertions && Array.isArray(assertions)) {
        for (const assertion of assertions) {
          let passed = false;
          let actual = "";

          switch (assertion.type) {
            case "status":
              actual = String(responseStatus);
              passed = responseStatus === Number(assertion.expected);
              break;
            case "body_contains":
              actual = responseBody.includes(assertion.expected) ? "true" : "false";
              passed = responseBody.includes(assertion.expected);
              break;
            case "header_exists":
              actual = responseHeaders[assertion.key.toLowerCase()] ? "exists" : "missing";
              passed = !!responseHeaders[assertion.key.toLowerCase()];
              break;
            case "response_time":
              actual = String(responseTime);
              passed = responseTime <= Number(assertion.expected);
              break;
            case "json_path":
              try {
                const jsonBody = JSON.parse(responseBody);
                const value = getJsonPath(jsonBody, assertion.path);
                actual = String(value);
                passed = String(value) === String(assertion.expected);
              } catch {
                actual = "Invalid JSON";
                passed = false;
              }
              break;
          }

          assertionResults.push({
            assertion: assertion.description || `${assertion.type}: ${assertion.expected}`,
            passed,
            actual,
          });

          if (!passed) {
            status = "failed";
          }
        }
      }

      // Store execution result using service role
      const adminSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: execution, error: insertError } = await adminSupabase
        .from("api_test_executions")
        .insert({
          endpoint_id: endpointId,
          test_plan_id: testPlanId || null,
          executor_id: userId,
          method,
          url,
          request_headers: requestHeaders,
          request_body: typeof body === "string" ? body : JSON.stringify(body),
          response_status: responseStatus,
          response_headers: responseHeaders,
          response_body: responseBody,
          response_time_ms: responseTime,
          status,
          assertions: assertions || [],
          assertion_results: assertionResults,
          executed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error storing execution:", insertError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          execution: {
            id: execution?.id,
            status,
            responseStatus,
            responseTime,
            responseBody,
            responseHeaders,
            assertionResults,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (fetchError) {
      const responseTime = Date.now() - startTime;
      
      // Store failed execution
      const adminSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await adminSupabase
        .from("api_test_executions")
        .insert({
          endpoint_id: endpointId,
          test_plan_id: testPlanId || null,
          executor_id: userId,
          method,
          url,
          request_headers: requestHeaders,
          request_body: typeof body === "string" ? body : JSON.stringify(body),
          response_status: 0,
          response_body: fetchError instanceof Error ? fetchError.message : "Request failed",
          response_time_ms: responseTime,
          status: "failed",
          assertions: assertions || [],
          assertion_results: [],
          executed_at: new Date().toISOString(),
          notes: `Error: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
        });

      return new Response(
        JSON.stringify({
          success: false,
          error: fetchError instanceof Error ? fetchError.message : "Request failed",
          execution: {
            status: "failed",
            responseStatus: 0,
            responseTime,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error executing API test:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getJsonPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}
