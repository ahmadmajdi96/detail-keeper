import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2, CheckCircle2, XCircle, Clock, Ban, Download, FileText, FileCode2, ListChecks,
} from "lucide-react";

export type JobKind = "docs" | "cases" | "code";

export interface JobState {
  kind: JobKind;
  status: string | null | undefined;
  progress: number | null | undefined;
  message: string | null | undefined;
}

const META: Record<JobKind, { label: string; icon: JSX.Element; accent: string; bar: string }> = {
  docs: {
    label: "QA documents",
    icon: <FileText className="h-3.5 w-3.5" />,
    accent: "border-violet-500/40 bg-violet-500/10 text-violet-300",
    bar: "from-violet-400 to-fuchsia-400",
  },
  cases: {
    label: "Test cases",
    icon: <ListChecks className="h-3.5 w-3.5" />,
    accent: "border-accent/40 bg-accent/10 text-accent",
    bar: "from-cyan-400 to-violet-500",
  },
  code: {
    label: "Playwright code",
    icon: <FileCode2 className="h-3.5 w-3.5" />,
    accent: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    bar: "from-cyan-400 to-emerald-400",
  },
};

/** Normalise the many upstream status spellings into 4 UI states. */
export function normalizeStatus(s: string | null | undefined) {
  const v = String(s || "").toLowerCase();
  if (["queued", "pending", "accepted"].includes(v)) return "queued" as const;
  if (["running", "in_progress", "processing", "started"].includes(v)) return "running" as const;
  if (["ready", "succeeded", "completed", "success", "done"].includes(v)) return "succeeded" as const;
  if (["failed", "error"].includes(v)) return "failed" as const;
  if (["cancelled", "canceled"].includes(v)) return "cancelled" as const;
  return "idle" as const;
}

function StatusPill({ state }: { state: ReturnType<typeof normalizeStatus> }) {
  const map = {
    queued: { txt: "Queued", cls: "border-amber-400/40 bg-amber-400/10 text-amber-300", icon: <Clock className="h-3 w-3" /> },
    running: { txt: "Running", cls: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    succeeded: { txt: "Succeeded", cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300", icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { txt: "Failed", cls: "border-red-400/40 bg-red-400/10 text-red-300", icon: <XCircle className="h-3 w-3" /> },
    cancelled: { txt: "Cancelled", cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground", icon: <Ban className="h-3 w-3" /> },
    idle: { txt: "Not started", cls: "border-border bg-muted/30 text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
  }[state];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${map.cls}`}>
      {map.icon}{map.txt}
    </span>
  );
}

interface Props {
  testPlanId: string;
  jobs: JobState[];
}

/**
 * Visible progress UI for every Repo Reader job attached to a test plan.
 * Reflects queued / running / succeeded / failed / cancelled, allows cancelling
 * in-flight jobs and downloading the generated bundle.
 */
export function GenerationStatusStrip({ testPlanId, jobs }: Props) {
  const qc = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const cancel = async (kind: JobKind) => {
    setPending(`cancel-${kind}`);
    try {
      const { data, error } = await supabase.functions.invoke("tp-forge-cancel", {
        body: { test_plan_id: testPlanId, kind },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        (data as any)?.remote_acknowledged
          ? `${META[kind].label} job cancelled`
          : `${META[kind].label} job marked cancelled (the service did not confirm)`,
      );
      qc.invalidateQueries({ queryKey: ["tp-progress", testPlanId] });
      qc.invalidateQueries({ queryKey: ["test-plan", testPlanId] });
    } catch (e: any) {
      toast.error(e.message || "Could not cancel the job");
    } finally { setPending(null); }
  };

  const download = async (kind: JobKind) => {
    setPending(`dl-${kind}`);
    const t = toast.loading("Fetching bundle from Repo Reader…");
    try {
      const { data, error } = await supabase.functions.invoke("tp-rr-download", {
        body: { test_plan_id: testPlanId, kind },
      });
      if (error) throw error;
      let blob: Blob | null = data instanceof Blob ? data : null;
      if (!blob && data && typeof data === "object" && (data as any).error) {
        throw new Error((data as any).error);
      }
      if (!blob) throw new Error("Repo Reader did not return a ZIP archive for this job.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generated-${kind}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download started", { id: t });
    } catch (e: any) {
      toast.error(e.message || "Download failed", { id: t });
    } finally { setPending(null); }
  };

  const visible = jobs.filter(j => normalizeStatus(j.status) !== "idle");
  if (visible.length === 0) return null;

  return (
    <div className="border-b border-border/50 bg-muted/10 px-3 py-2 space-y-2">
      {visible.map((job) => {
        const state = normalizeStatus(job.status);
        const m = META[job.kind];
        const active = state === "queued" || state === "running";
        const pct = Math.max(4, Math.min(100, Number(job.progress) || (state === "succeeded" ? 100 : 8)));
        return (
          <div key={job.kind} className={`rounded-md border px-2.5 py-2 space-y-1.5 ${m.accent}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {m.icon}
              <span className="font-medium">{m.label}</span>
              <StatusPill state={state} />
              {active && (
                <span className="text-[11px] opacity-80">Safe to navigate — we'll notify you when it finishes.</span>
              )}
              <span className="ml-auto font-mono text-[11px] opacity-80">
                {state === "succeeded" ? "100%" : typeof job.progress === "number" ? `${job.progress}%` : "…"}
              </span>
              {active && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                      disabled={pending === `cancel-${job.kind}`}>
                      {pending === `cancel-${job.kind}`
                        ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        : <Ban className="h-3 w-3 mr-1" />}
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel {m.label.toLowerCase()} job?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The running job is stopped at Repo Reader and marked cancelled here. Any artifacts already
                        persisted stay in place, but the remaining output will not be generated.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep running</AlertDialogCancel>
                      <AlertDialogAction onClick={() => cancel(job.kind)}>Cancel job</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {(state === "succeeded" || state === "failed") && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                  disabled={pending === `dl-${job.kind}`}
                  onClick={() => download(job.kind)}
                  title="Download the generated bundle (download.zip) for the latest job">
                  {pending === `dl-${job.kind}`
                    ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    : <Download className="h-3 w-3 mr-1" />}
                  ZIP
                </Button>
              )}
            </div>
            {state !== "cancelled" && (
              <div className="h-1 w-full overflow-hidden rounded-full bg-background/40">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${state === "failed" ? "from-red-500 to-red-400" : m.bar} transition-[width] duration-700`}
                  style={{ width: `${state === "failed" ? 100 : pct}%` }}
                />
              </div>
            )}
            {job.message && <p className="text-[11px] opacity-80 line-clamp-2">{job.message}</p>}
          </div>
        );
      })}
    </div>
  );
}
