import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Activity, CheckCircle2, ChevronDown, ChevronUp, Loader2, X, XCircle, Circle,
  Download, Lock, ShieldOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCan } from "@/hooks/useCan";
import { downloadStageArtifacts, stageDownloadKey, STAGE_DOWNLOAD_LABEL } from "@/lib/stageArtifacts";
import { logArtifactAccess } from "@/lib/artifactAccessAudit";
import {
  STAGE_LABELS, StageEvent, StageId, readStages, clearStages, clearBusy,
} from "@/lib/jobBusyStore";

export type TrackedJob = {
  planId: string;
  planName: string;
  kind: "cases" | "code" | "docs";
  status: string;
  progress: number | null;
  message: string | null;
  startedAt: number;
  dryRun?: boolean;
};

const PIPELINE: Record<"cases" | "code" | "docs", StageId[]> = {
  cases: ["submit", "docs", "cases", "persist"],
  code: ["submit", "codegen", "persist"],
  docs: ["submit", "docs", "persist"],
};

function StageRow({
  stage, events, active, planId, canDownload, role,
}: {
  stage: StageId; events: StageEvent[]; active: boolean;
  planId: string; canDownload: boolean; role: string | null;
}) {
  const mine = events.filter((e) => e.stage === stage);
  const first = mine[0];
  const last = mine[mine.length - 1];
  const done = events.some((e) => e.stage === "done") || (mine.length > 0 && !active);
  const failed = events.some((e) => e.stage === "failed") && active;
  const [downloading, setDownloading] = useState(false);
  const dlKey = stageDownloadKey(stage);
  const reachable = mine.length > 0 || events.some((e) => e.stage === "done" || e.stage === "failed");

  const grab = async () => {
    if (!dlKey) return;
    // Every attempt is audited — including the ones the role is not allowed to make.
    if (!canDownload) {
      logArtifactAccess({
        action: "artifact.stage_download_denied",
        planId, stage: dlKey, role,
        reason: "missing artifact.view capability",
      });
      toast.error("Your role cannot download artifacts for this stage");
      return;
    }
    setDownloading(true);
    const t = toast.loading(`${STAGE_DOWNLOAD_LABEL[dlKey]}…`);
    try {
      const n = await downloadStageArtifacts(planId, dlKey);
      logArtifactAccess({
        action: "artifact.stage_download_allowed",
        planId, stage: dlKey, role, meta: { files: n },
      });
      if (n === 0) toast.info("Nothing generated for this stage yet", { id: t });
      else toast.success(`Downloaded ${n} file${n === 1 ? "" : "s"}`, { id: t });
    } catch (e: any) {
      toast.error(e.message || "Download failed", { id: t });
    } finally { setDownloading(false); }
  };

  return (
    <div className="relative pl-5 pb-2.5 last:pb-0">
      <span className="absolute left-[5px] top-4 bottom-0 w-px bg-border/60 last:hidden" />
      <span className="absolute left-0 top-1">
        {failed ? (
          <XCircle className="h-3 w-3 text-destructive" />
        ) : active ? (
          <Loader2 className="h-3 w-3 animate-spin text-accent" />
        ) : done ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        ) : (
          <Circle className="h-3 w-3 text-muted-foreground/50" />
        )}
      </span>
      <div className="flex items-baseline gap-2">
        <span className={`text-[11px] font-medium ${mine.length ? "text-foreground" : "text-muted-foreground/60"}`}>
          {STAGE_LABELS[stage]}
        </span>
        {dlKey && reachable && (
          <button
            onClick={grab}
            disabled={downloading}
            title={canDownload ? STAGE_DOWNLOAD_LABEL[dlKey] : "Your role cannot download these artifacts"}
            className={`disabled:opacity-50 ${canDownload
              ? "text-muted-foreground hover:text-accent"
              : "text-muted-foreground/40 hover:text-destructive"}`}
          >
            {downloading
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : canDownload ? <Download className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          </button>
        )}
        {first && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {format(new Date(first.at), "HH:mm:ss")}
            {last && last.at !== first.at ? ` → ${format(new Date(last.at), "HH:mm:ss")}` : ""}
          </span>
        )}
      </div>
      {mine.slice(-3).map((e, i) => (
        <p key={i} className="text-[10px] text-muted-foreground truncate">
          <span className="font-mono mr-1 opacity-70">{format(new Date(e.at), "HH:mm:ss")}</span>
          {e.message}
        </p>
      ))}
    </div>
  );
}


export function JobTrackerPanel({ jobs }: { jobs: TrackedJob[] }) {
  const navigate = useNavigate();
  const { can, projectRole, planRole, workspaceRole } = useCan();
  const canDownload = can("artifact.view");
  const effectiveRole = projectRole ?? planRole ?? workspaceRole ?? null;
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [stages, setStages] = useState<Record<string, StageEvent[]>>({});


  useEffect(() => {
    const next: Record<string, StageEvent[]> = {};
    for (const j of jobs) next[j.planId] = readStages(j.planId);
    setStages(next);
  }, [jobs]);

  const visible = jobs.filter((j) => !dismissed.includes(`${j.kind}:${j.planId}`));
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[340px] max-w-[calc(100vw-2rem)]" data-testid="job-tracker-panel">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-accent/30 bg-card/95 backdrop-blur-xl shadow-[0_0_30px_-10px_hsl(var(--accent))] overflow-hidden"
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/30 text-xs font-semibold"
        >
          <Activity className="h-3.5 w-3.5 text-accent animate-pulse" />
          Background jobs
          <Badge variant="outline" className="text-[10px]">{visible.length}</Badge>
          <span className="ml-auto">{collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span>
        </button>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-[52vh] overflow-y-auto divide-y divide-border/40">
                {visible.map((j) => {
                  const evs = stages[j.planId] ?? [];
                  const terminal = j.status === "ready" || j.status === "failed";
                  const pipeline = PIPELINE[j.kind];
                  const currentStage = evs.length ? evs[evs.length - 1].stage : "submit";
                  return (
                    <div key={`${j.kind}:${j.planId}`} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium truncate flex-1" title={j.planName}>{j.planName}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {j.kind === "code" ? "codegen" : "test cases"}
                        </Badge>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          title="Hide"
                          onClick={() => {
                            setDismissed((d) => [...d, `${j.kind}:${j.planId}`]);
                            if (terminal) { clearBusy(j.planId); clearStages(j.planId); }
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      {j.dryRun && (
                        <div className="flex items-center gap-1 rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                          <ShieldOff className="h-3 w-3" />
                          Dry run — install &amp; execution skipped
                        </div>
                      )}

                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                          animate={{ width: `${Math.max(4, Math.min(100, j.progress ?? 8))}%` }}
                          transition={{ duration: 0.6 }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span>started {format(new Date(j.startedAt), "HH:mm:ss")}</span>
                        <span>{j.progress != null ? `${j.progress}%` : "…"}</span>
                      </div>

                      <div className="pt-1">
                        {pipeline.map((s) => (
                          <StageRow
                            key={s}
                            stage={s}
                            role={effectiveRole}
                            events={evs}
                            active={!terminal && s === currentStage}
                            planId={j.planId}
                            canDownload={canDownload}
                          />
                        ))}
                      </div>


                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-full text-[11px]"
                        onClick={() => navigate(`/test-plans/${j.planId}`)}
                      >
                        Open test plan
                      </Button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
