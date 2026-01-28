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

    const { documentId, documentContent } = await req.json();

    if (!documentId || !documentContent) {
      return new Response(
        JSON.stringify({ error: "Document ID and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an expert API documentation analyzer. Your task is to extract ALL API endpoints from the provided document content.

For each endpoint, extract:
1. HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)
2. Path/URL pattern (e.g., /api/users/{id})
3. Summary (brief description)
4. Full description
5. Parameters (path params, query params, their types, required/optional)
6. Request body schema (if applicable)
7. Response schema (expected response format)
8. Headers (required headers)
9. Authentication requirements
10. Tags/categories

Return a JSON array of endpoints with this structure:
{
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/users/{id}",
      "summary": "Get user by ID",
      "description": "Retrieves a user's details by their unique identifier",
      "parameters": [
        {"name": "id", "in": "path", "type": "string", "required": true, "description": "User ID"}
      ],
      "requestBody": null,
      "responseSchema": {"type": "object", "properties": {"id": {"type": "string"}, "name": {"type": "string"}}},
      "headers": [{"name": "Authorization", "required": true, "description": "Bearer token"}],
      "authentication": "Bearer Token",
      "tags": ["users"]
    }
  ]
}

Be thorough and extract every single endpoint mentioned in the document.`;

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
          { role: "user", content: `Please analyze this document and extract all API endpoints:\n\n${documentContent}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_endpoints",
              description: "Extract API endpoints from document",
              parameters: {
                type: "object",
                properties: {
                  endpoints: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        method: { type: "string" },
                        path: { type: "string" },
                        summary: { type: "string" },
                        description: { type: "string" },
                        parameters: { type: "array" },
                        requestBody: { type: "object" },
                        responseSchema: { type: "object" },
                        headers: { type: "array" },
                        authentication: { type: "string" },
                        tags: { type: "array", items: { type: "string" } },
                      },
                      required: ["method", "path"],
                    },
                  },
                },
                required: ["endpoints"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_endpoints" } },
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
    let endpoints = [];

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      endpoints = parsed.endpoints || [];
    }

    // Store endpoints in database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const insertedEndpoints = [];
    for (const endpoint of endpoints) {
      const { data, error } = await supabase
        .from("api_endpoints")
        .insert({
          document_id: documentId,
          method: endpoint.method,
          path: endpoint.path,
          summary: endpoint.summary,
          description: endpoint.description,
          parameters: endpoint.parameters || [],
          request_body: endpoint.requestBody,
          response_schema: endpoint.responseSchema,
          headers: endpoint.headers || [],
          authentication: endpoint.authentication,
          tags: endpoint.tags || [],
        })
        .select()
        .single();

      if (error) {
        console.error("Error inserting endpoint:", error);
      } else {
        insertedEndpoints.push(data);
      }
    }

    // Update document status
    await supabase
      .from("documents")
      .update({
        status: "processed",
        requirements_count: insertedEndpoints.length,
        processed_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return new Response(
      JSON.stringify({ success: true, endpoints: insertedEndpoints }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing document:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
