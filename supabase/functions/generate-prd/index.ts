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

    const systemPrompt = `You are a senior product manager creating a Product Requirements Document (PRD) for an API endpoint.

Create a comprehensive PRD that includes:
1. Title
2. Overview/Introduction
3. Objectives (what this endpoint aims to achieve)
4. Functional Requirements (detailed list)
5. Non-Functional Requirements (performance, security, scalability)
6. Acceptance Criteria (specific, testable criteria)
7. Dependencies (other systems, services, or endpoints this depends on)
8. Risks and Mitigations

Be thorough and professional. Consider edge cases, error handling, and security aspects.`;

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
- Tags: ${endpoint.tags?.join(", ") || "N/A"}
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
          { role: "user", content: `Generate a PRD for this API endpoint:\n${endpointInfo}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_prd",
              description: "Generate a PRD for an API endpoint",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  overview: { type: "string" },
                  objectives: { type: "array", items: { type: "string" } },
                  functional_requirements: { type: "array", items: { type: "string" } },
                  non_functional_requirements: { type: "array", items: { type: "string" } },
                  acceptance_criteria: { type: "array", items: { type: "string" } },
                  dependencies: { type: "array", items: { type: "string" } },
                  risks: { type: "array", items: { type: "object", properties: { risk: { type: "string" }, mitigation: { type: "string" } } } },
                  full_content: { type: "string" },
                },
                required: ["title", "overview", "objectives", "functional_requirements", "acceptance_criteria"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_prd" } },
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
    let prd = null;

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      prd = JSON.parse(toolCall.function.arguments);
    }

    if (!prd) {
      throw new Error("Failed to generate PRD");
    }

    // Store PRD in database
    const { data: insertedPrd, error: insertError } = await supabase
      .from("endpoint_prds")
      .insert({
        endpoint_id: endpointId,
        title: prd.title,
        overview: prd.overview,
        objectives: prd.objectives,
        functional_requirements: prd.functional_requirements,
        non_functional_requirements: prd.non_functional_requirements || [],
        acceptance_criteria: prd.acceptance_criteria,
        dependencies: prd.dependencies || [],
        risks: prd.risks || [],
        full_content: prd.full_content || "",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting PRD:", insertError);
      throw new Error("Failed to save PRD");
    }

    return new Response(
      JSON.stringify({ success: true, prd: insertedPrd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating PRD:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
