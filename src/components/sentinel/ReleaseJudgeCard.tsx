import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, ThumbsUp, ThumbsDown, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

interface Props {
  cycleRunId?: string | null;
  releaseId?: string | null;
  projectId?: string | null;
  workspaceId?: string | null;
}

const verdictStyle: Record<string, { icon: any; cls: string }> = {
  approve: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  block: { icon: XCircle, cls: "bg-red-500/10 text-red-300 border-red-500/30" },
  warn: { icon: AlertTriangle, cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  pending: { icon: Loader2, cls: "bg-muted text-muted-foreground" },
};

export function ReleaseJudgeCard({ cycleRunId, releaseId, projectId, workspaceId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["release-eval", cycleRunId, releaseId];

  const { data: evals = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = (supabase as any).from("release_evaluations").select("*").order("created_at", { ascending: false }).limit(5);
      if (cycleRunId) q = q.eq("cycle_run_id", cycleRunId);
      else if (releaseId) q = q.eq("release_id", releaseId);
      else return [];
      const { data } = await q;
      return data || [];
    },
    enabled: !!(cycleRunId || releaseId),
  });

  useEffect(() => {
    if (!cycleRunId && !releaseId) return;
    const filter = cycleRunId ? `cycle_run_id=eq.${cycleRunId}` : `release_id=eq.${releaseId}`;
    const ch = supabase.channel(`re-${cycleRunId || releaseId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "release_evaluations", filter },
        () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cycleRunId, releaseId]);

  const enqueue = useMutation({
    mutationFn: async () => {
      if (!cycleRunId || !projectId || !workspaceId) throw new Error("Missing context");
      const { error } = await (supabase as any).from("jobs").insert({
        workspace_id: workspaceId, project_id: projectId, kind: "ai_release_judge",
        payload: { cycle_run_id: cycleRunId, project_id: projectId, release_id: releaseId },
        priority: 80, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("AI judge queued"),
    onError: (e: any) => toast.error(e.message),
  });

  const feedback = useMutation({
    mutationFn: async ({ id, score }: { id: string; score: 1 | -1 }) => {
      const { error } = await (supabase as any).from("release_evaluations")
        .update({ feedback_score: score, feedback_by: user?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Feedback recorded"); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e.message),
  });

  const latest = evals[0];

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          AI Release Judge
        </CardTitle>
        {cycleRunId && (
          <Button size="sm" variant="outline" onClick={() => enqueue.mutate()} disabled={enqueue.isPending}>
            {enqueue.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Re-run
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!latest ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No evaluation yet. {cycleRunId && "Will run automatically when the cycle run completes."}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={verdictStyle[latest.verdict]?.cls}>
                {latest.verdict?.toUpperCase()}
              </Badge>
              {latest.score != null && <span className="text-sm font-medium">Score: {Number(latest.score).toFixed(0)}/100</span>}
              <span className="text-xs text-muted-foreground ml-auto">{new Date(latest.created_at).toLocaleString()}</span>
            </div>
            {latest.summary && <p className="text-sm">{latest.summary}</p>}
            {Array.isArray(latest.failure_themes) && latest.failure_themes.length > 0 && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Failure themes</div>
                <ul className="text-sm space-y-1">
                  {latest.failure_themes.map((t: any, i: number) => (
                    <li key={i}>• {t.theme}{t.count ? ` (${t.count})` : ""}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(latest.next_actions) && latest.next_actions.length > 0 && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Next actions</div>
                <ul className="text-sm space-y-1">
                  {latest.next_actions.map((a: string, i: number) => <li key={i}>→ {a}</li>)}
                </ul>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2 border-t border-border/40">
              <span className="text-xs text-muted-foreground">Was this helpful?</span>
              <Button size="icon" variant={latest.feedback_score === 1 ? "default" : "ghost"}
                className="h-7 w-7" onClick={() => feedback.mutate({ id: latest.id, score: 1 })}>
                <ThumbsUp className="h-3 w-3" />
              </Button>
              <Button size="icon" variant={latest.feedback_score === -1 ? "default" : "ghost"}
                className="h-7 w-7" onClick={() => feedback.mutate({ id: latest.id, score: -1 })}>
                <ThumbsDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
