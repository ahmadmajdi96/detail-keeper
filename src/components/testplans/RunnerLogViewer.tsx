import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, Lock, Terminal } from "lucide-react";
import { useCan } from "@/hooks/useCan";
import { FileIcon } from "@/lib/fileIcons";
import { logArtifactAccess } from "@/lib/artifactAccessAudit";

export type RunnerLogSource = {
  /** Anything the Forge runner returned: artifacts_json, stdout, stderr. */
  artifacts?: any;
  stdout?: string | null;
  stderr?: string | null;
  title?: string;
};

/** Collects every log-looking payload the runner returned into named files. */
export function collectRunnerLogs(src: RunnerLogSource): Array<{ name: string; content: string }> {
  const out: Array<{ name: string; content: string }> = [];
  const push = (name: string, content: unknown) => {
    if (content == null) return;
    const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    if (!text.trim()) return;
    if (out.some((o) => o.name === name)) return;
    out.push({ name, content: text });
  };

  const a = src.artifacts || {};
  // Common shapes: { logs: { "npm-install.log": "..." } } or { logs: [{name, content}] }
  const logs = a.logs ?? a.log ?? a.runner_logs;
  if (Array.isArray(logs)) {
    for (const l of logs) push(l?.name || l?.filename || "runner.log", l?.content ?? l?.body ?? l);
  } else if (logs && typeof logs === "object") {
    for (const [k, v] of Object.entries(logs)) push(k, v);
  } else if (typeof logs === "string") {
    push("runner.log", logs);
  }

  push("npm-install.log", a["npm-install.log"] ?? a.npm_install_log ?? a.install_log);
  push("playwright.log", a["playwright.log"] ?? a.playwright_log ?? a.test_log);
  push("stdout.log", src.stdout);
  push("stderr.log", src.stderr);
  if (a.error) push("error.log", a.error);

  return out;
}

export function RunnerLogViewer({
  open, onOpenChange, source, planId, stage, jobId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  source: RunnerLogSource | null;
  /** Used to resolve the viewer's plan-level role. */
  planId?: string;
  /** Pipeline stage / job the logs belong to — recorded in the access audit. */
  stage?: string;
  jobId?: string;
}) {
  const { can, projectRole, planRole, workspaceRole } = useCan({ planId: planId ?? null });
  const allowed = can("runnerlog.view");
  const role = projectRole ?? planRole ?? workspaceRole ?? null;
  const files = useMemo(() => (source && allowed ? collectRunnerLogs(source) : []), [source, allowed]);
  const [active, setActive] = useState(0);
  const current = files[active];

  // Record the allow/deny decision once per time the viewer is opened.
  useEffect(() => {
    if (!open) return;
    logArtifactAccess({
      action: allowed ? "runnerlog.view_allowed" : "runnerlog.view_denied",
      planId: planId ?? null,
      stage: stage ?? "run",
      jobId: jobId ?? null,
      role,
      reason: allowed ? null : "missing runnerlog.view capability",
      meta: { log_files: allowed ? files.length : 0, title: source?.title ?? null },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allowed, planId, jobId]);

  const download = (name: string, content: string) => {
    if (!allowed) {
      logArtifactAccess({
        action: "runnerlog.download_denied",
        planId: planId ?? null, stage: stage ?? "run", jobId: jobId ?? null, role,
        reason: "missing runnerlog.view capability", meta: { file: name },
      });
      return;
    }
    logArtifactAccess({
      action: "runnerlog.download_allowed",
      planId: planId ?? null, stage: stage ?? "run", jobId: jobId ?? null, role,
      meta: { file: name, bytes: content.length },
    });
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Terminal className="h-4 w-4 text-accent" />
            Runner logs {source?.title ? `· ${source.title}` : ""}
            <Badge variant="outline" className="ml-1 text-[10px]">{files.length} file{files.length === 1 ? "" : "s"}</Badge>
            {allowed && current && (
              <Button size="sm" variant="ghost" className="ml-auto"
                onClick={() => download(current.name, current.content)}>
                <Download className="h-3.5 w-3.5 mr-1" /> Download
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {!allowed ? (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-6">
            <Lock className="h-3.5 w-3.5" />
            Runner logs are restricted to project leads, contributors and plan reviewers.
          </p>
        ) : files.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            The runner did not return any logs for this job.
          </p>
        ) : (
          <div className="grid grid-cols-12 gap-3">
            <ScrollArea className="col-span-4 h-[420px] border border-border/50 rounded">
              <div className="p-1.5 space-y-0.5">
                {files.map((f, i) => (
                  <button key={f.name} onClick={() => setActive(i)}
                    className={`w-full flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded truncate ${
                      i === active ? "bg-accent/15 text-accent" : "hover:bg-muted/40"}`}>
                    <FileIcon name={f.name} />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {Math.max(1, Math.round(f.content.length / 1024))}k
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
            <div className="col-span-8 border border-border/50 rounded overflow-hidden">
              <Editor
                height="420px"
                language="plaintext"
                theme="vs-dark"
                value={current?.content ?? ""}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, wordWrap: "on" }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
