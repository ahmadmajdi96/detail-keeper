import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, RefreshCw, RotateCw, FileDown, AlertTriangle, ChevronDown, ChevronRight,
  GitBranch, FileArchive, FileText, History,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IngestStatusBadge } from "./DocumentIngestPanel";

interface Props {
  projectId: string;
  canEdit: boolean;
}

type IngestJob = {
  id: string;
  job_ref: string | null;
  ingest_type: string;
  source_name: string | null;
  status: string;
  stage: string | null;
  progress: number;
  error: string | null;
  document_errors: { filename: string; error: string }[] | null;
  documents: { filename: string; bytes: number | null }[] | null;
  stages: { stage: string; at: string; progress?: number | null }[] | null;
  payload: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

const TYPE_META: Record<string, { label: string; Icon: typeof GitBranch }> = {
  repo_clone: { label: "Repo clone", Icon: GitBranch },
  repo_zip: { label: "Repo ZIP", Icon: FileArchive },
  brd_file: { label: "BRD file", Icon: FileText },
  brd_text: { label: "BRD text", Icon: FileText },
};

const TERMINAL = ["processed", "failed"];

export function IngestJobsPanel({ projectId, canEdit }: Props) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const jobsQ = useQuery({
    queryKey: ["ingest-jobs", projectId],
    queryFn: async (): Promise<IngestJob[]> => {
      const { data, error } = await (supabase as any)
        .from("ingest_jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as IngestJob[];
    },
    refetchInterval: (q) =>
      ((q.state.data as IngestJob[] | undefined) || []).some((jb) => !TERMINAL.includes(jb.status))
        ? 4000
        : false,
  });

  const jobs = jobsQ.data || [];

  const filtered = useMemo(
    () =>
      jobs.filter(
        (jb) =>
          (statusFilter === "all" || jb.status === statusFilter) &&
          (typeFilter === "all" || jb.ingest_type === typeFilter),
      ),
    [jobs, statusFilter, typeFilter],
  );

  const call = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("repo-reader", {
      body: { action, project_id: projectId, ...payload },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["ingest-jobs", projectId] });
    qc.invalidateQueries({ queryKey: ["generated-docs", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["documents"] });
  };

  const resync = async (jb: IngestJob) => {
    setBusyId(jb.id);
    try {
      await call("job");
      await call("docs-sync");
      refreshAll();
      toast.success("Ingestion refreshed");
    } catch (e: any) {
      toast.error(e.message || "Resync failed");
    } finally {
      setBusyId(null);
    }
  };

  const retry = async (jb: IngestJob) => {
    setBusyId(jb.id);
    try {
      if (jb.ingest_type === "repo_clone") {
        await call("clone", {
          repo_url: jb.payload?.repo_url,
          branch: jb.payload?.branch,
          visibility: jb.payload?.visibility,
        });
      } else if (jb.ingest_type === "brd_text") {
        await call("brd-generate", {
          filename: jb.source_name || "system-brd.md",
          content: jb.payload?.content || "",
        });
      } else {
        toast.error("Uploaded files can't be replayed — please upload the file again.");
        return;
      }
      refreshAll();
      toast.success("Ingestion restarted");
    } catch (e: any) {
      toast.error(e.message || "Retry failed");
    } finally {
      setBusyId(null);
    }
  };

  const downloadZip = async (jb: IngestJob) => {
    setBusyId(jb.id);
    try {
      const data = await call("download-zip");
      const bin = atob(data.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || "repo-reader-output.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Output ZIP downloaded");
    } catch (e: any) {
      toast.error(e.message || "Download failed");
    } finally {
      setBusyId(null);
    }
  };

  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <Card>
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-accent" />
          <span className="font-semibold text-sm">Ingestion history</span>
          <Badge variant="outline" className="text-[10px]">{filtered.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="repo_zip">Repo ZIP</SelectItem>
              <SelectItem value="repo_clone">Repo clone</SelectItem>
              <SelectItem value="brd_file">BRD file</SelectItem>
              <SelectItem value="brd_text">BRD text</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={refreshAll}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <CardContent className="p-3 space-y-2">
        {jobsQ.isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          </div>
        )}
        {!jobsQ.isLoading && filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No ingestion jobs match these filters.
          </div>
        )}
        {filtered.map((jb) => {
          const meta = TYPE_META[jb.ingest_type] || { label: jb.ingest_type, Icon: FileText };
          const running = !TERMINAL.includes(jb.status);
          const expanded = open.has(jb.id);
          const fileErrors = jb.document_errors || [];
          return (
            <div
              key={jb.id}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                jb.status === "failed" ? "border-destructive/30 bg-destructive/5" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggle(jb.id)}
                    className="mt-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={expanded ? "Collapse" : "Expand"}
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <meta.Icon className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{jb.source_name || jb.job_ref}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {meta.label} · {new Date(jb.created_at).toLocaleString()}
                      {jb.stage ? <> · {jb.stage}</> : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <IngestStatusBadge status={jb.status === "processed" ? "succeeded" : jb.status} />
                  {jb.status === "processed" && (
                    <Button size="sm" variant="outline" disabled={busyId === jb.id} onClick={() => downloadZip(jb)}>
                      <FileDown className="h-3.5 w-3.5 mr-1" /> Output ZIP
                    </Button>
                  )}
                  {canEdit && (
                    <>
                      <Button size="sm" variant="outline" disabled={busyId === jb.id} onClick={() => resync(jb)}>
                        {busyId === jb.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                        Resync
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === jb.id || !["repo_clone", "brd_text"].includes(jb.ingest_type)}
                        title={
                          ["repo_clone", "brd_text"].includes(jb.ingest_type)
                            ? "Re-run this ingestion"
                            : "Uploaded files must be re-uploaded to retry"
                        }
                        onClick={() => retry(jb)}
                      >
                        <RotateCw className="h-3.5 w-3.5 mr-1" /> Retry
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {running && (
                <div className="mt-3">
                  <Progress value={jb.progress || 5} className="h-1.5" />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {jb.stage || "Queued"} · {jb.progress ?? 0}%
                  </div>
                </div>
              )}

              {expanded && (
                <div className="mt-3 space-y-3 text-xs">
                  {jb.job_ref && (
                    <div className="font-mono text-[10px] text-muted-foreground">Job {jb.job_ref}</div>
                  )}

                  {(jb.stages || []).length > 0 && (
                    <div className="space-y-1">
                      <div className="font-medium">Stages</div>
                      {(jb.stages || []).map((s, i) => (
                        <div key={i} className="flex items-center justify-between text-muted-foreground">
                          <span>{s.stage}</span>
                          <span className="font-mono text-[10px]">{new Date(s.at).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {jb.error && (
                    <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                      <div className="flex items-center gap-1 font-medium mb-1">
                        <AlertTriangle className="h-3.5 w-3.5" /> Job error
                      </div>
                      <div className="whitespace-pre-wrap break-words">{jb.error}</div>
                    </div>
                  )}

                  {fileErrors.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-medium text-destructive">Per-file errors ({fileErrors.length})</div>
                      {fileErrors.map((fe, i) => (
                        <div key={i} className="rounded border border-destructive/25 bg-destructive/5 p-2">
                          <div className="font-mono text-[10px]">{fe.filename}</div>
                          <div className="text-destructive whitespace-pre-wrap break-words">{fe.error}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(jb.documents || []).length > 0 && (
                    <div className="space-y-1">
                      <div className="font-medium">Generated files ({(jb.documents || []).length})</div>
                      {(jb.documents || []).map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-muted-foreground">
                          <span className="font-mono text-[10px]">{d.filename}</span>
                          <span>{d.bytes != null ? `${(d.bytes / 1024).toFixed(1)} KB` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
