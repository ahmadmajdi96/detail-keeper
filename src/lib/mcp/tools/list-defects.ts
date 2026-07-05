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
  name: "list_defects",
  title: "List defects",
  description: "List Qualixa defects with optional project and status filters.",
  inputSchema: {
    project_id: z.string().uuid().optional(),
    status: z.string().optional().describe("Filter by status (e.g. open, closed, in_progress)."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ project_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    let q = sb(ctx).from("defects").select("id, title, status, severity, priority, project_id, assigned_to, reported_by, created_at").order("created_at", { ascending: false }).limit(limit ?? 50);
    if (project_id) q = q.eq("project_id", project_id);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { defects: data ?? [] } };
  },
});
