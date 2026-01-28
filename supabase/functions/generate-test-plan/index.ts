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

    const { endpointId } = await req.json();

    if (!endpointId) {
      return new Response(
        JSON.stringify({ error: "Endpoint ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch endpoint details
    const { data: endpoint, error: endpointError } = await supabase
      .from("api_endpoints")
      .select("*")
      .eq("id", endpointId)
      .single();

    if (endpointError || !endpoint) {
      return new Response(
        JSON.stringify({ error: "Endpoint not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a senior QA engineer creating a comprehensive test plan for an API endpoint.

Create a test plan that includes:
1. Name and description
2. Test cases covering:
   - Positive scenarios (valid inputs, expected responses)
   - Negative scenarios (invalid inputs, error handling)
   - Edge cases (boundary values, empty inputs, special characters)
   - Security tests (authentication, authorization, injection attacks)
   - Performance considerations
3. Coverage areas (what aspects are being tested)
4. Test data examples (sample request/response data)
5. Preconditions (setup required before testing)

Each test case should have:
- ID, name, description
- Test type (positive, negative, edge_case, security, performance)
- Priority (high, medium, low)
- Steps to execute
- Expected result
- Sample request data`;

    const endpointInfo = `
API Endpoint Details:
- Method: ${endpoint.method}
- Path: ${endpoint.path}
- Summary: ${endpoint.summary || "N/A"}
- Description: ${endpoint.description || "N/A"}
- Parameters: ${JSON.stringify(endpoint.parameters, null, 2)}
- Request Body: ${JSON.stringify(endpoint.request_body, null, 2)}
- Response Schema: ${JSON.stringify(endpoint.response_schema, null, 2)}
- Headers: ${JSON.stringify(endpoint.headers, null, 2)}
- Authentication: ${endpoint.authentication || "N/A"}
`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate a comprehensive test plan for this API endpoint:\n${endpointInfo}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_test_plan",
              description: "Generate a test plan for an API endpoint",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  test_cases: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        description: { type: "string" },
                        type: { type: "string", enum: ["positive", "negative", "edge_case", "security", "performance"] },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        steps: { type: "array", items: { type: "string" } },
                        expected_result: { type: "string" },
                        sample_request: { type: "object" },
                      },
                      required: ["id", "name", "type", "priority", "expected_result"],
                    },
                  },
                  coverage_areas: { type: "array", items: { type: "string" } },
                  test_data: { type: "array", items: { type: "object" } },
                  preconditions: { type: "string" },
                },
                required: ["name", "description", "test_cases"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_test_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    let testPlan = null;

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      testPlan = JSON.parse(toolCall.function.arguments);
    }

    if (!testPlan) {
      throw new Error("Failed to generate test plan");
    }

    // Store test plan in database
    const { data: insertedPlan, error: insertError } = await supabase
      .from("endpoint_test_plans")
      .insert({
        endpoint_id: endpointId,
        name: testPlan.name,
        description: testPlan.description,
        test_cases: testPlan.test_cases,
        coverage_areas: testPlan.coverage_areas || [],
        test_data: testPlan.test_data || [],
        preconditions: testPlan.preconditions || "",
        status: "draft",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting test plan:", insertError);
      throw new Error("Failed to save test plan");
    }

    return new Response(
      JSON.stringify({ success: true, testPlan: insertedPlan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating test plan:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
