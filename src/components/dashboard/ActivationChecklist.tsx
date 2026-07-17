import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, Circle, Upload, Sparkles, ServerCog, UserPlus, ArrowRight } from "lucide-react";

export function ActivationChecklist() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const navigate = useNavigate();
  const orgId = currentOrganization?.id;

  const { data } = useQuery({
    queryKey: ["activation-checklist", user?.id, orgId],
    enabled: !!user?.id && !!orgId,
    queryFn: async () => {
      const [docs, plans, runners, members] = await Promise.all([
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("test_plans").select("id", { count: "exact", head: true }),
        supabase.from("runners").select("id", { count: "exact", head: true }),
        supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("org_id", orgId!),
      ]);
      return {
        hasDoc: (docs.count || 0) > 0,
        hasPlan: (plans.count || 0) > 0,
        hasRunner: (runners.count || 0) > 0,
        hasTeammate: (members.count || 0) > 1,
      };
    },
    refetchInterval: 60000,
  });

  if (!data) return null;
  const steps = [
    { done: data.hasDoc, icon: Upload, label: "Import a source", desc: "Upload a doc, zip, or connect a GitHub repo", to: "/documents" },
    { done: data.hasPlan, icon: Sparkles, label: "Generate a test plan", desc: "Let AI draft a plan from your requirements", to: "/test-plans" },
    { done: data.hasRunner, icon: ServerCog, label: "Connect a runner", desc: "Register a runner to execute tests", to: "/runners" },
    { done: data.hasTeammate, icon: UserPlus, label: "Invite a teammate", desc: "Bring the rest of your team on board", to: "/organization" },
  ];
  const completedCount = steps.filter((s) => s.done).length;
  if (completedCount === steps.length) return null;

  return (
    <Card className="mb-6 border-accent/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> Get started
            </CardTitle>
            <CardDescription>{completedCount} of {steps.length} steps complete</CardDescription>
          </div>
          <div className="text-sm font-mono text-muted-foreground">{Math.round((completedCount / steps.length) * 100)}%</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(s.to)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:bg-muted/40 ${
              s.done ? "border-border/40 opacity-60" : "border-border"
            }`}
          >
            {s.done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${s.done ? "line-through text-muted-foreground" : ""}`}>{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.desc}</div>
            </div>
            {!s.done && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
