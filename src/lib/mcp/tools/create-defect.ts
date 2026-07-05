import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_defect",
  title: "Create defect",
  description: "File a new defect in a Qualixa project as the signed-in user.",
  inputSchema: {
    project_id: z.string().uuid().describe("Project the defect belongs to."),
    title: z.string().trim().min(1).describe("Short defect title."),
    description: z.string().optional().describe("Detailed description / reproduction steps."),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async ({ project_id, title, description, severity, priority }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await sb(ctx)
      .from("defects")
      .insert({ project_id, title, description, severity, priority, reported_by: ctx.getUserId(), status: "open" })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Created defect ${data.id}` }], structuredContent: { defect: data } };
  },
});
