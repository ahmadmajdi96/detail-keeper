import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, RefreshCw, Save, FileText, Sparkles, ChevronRight,
  CheckCircle2, PencilLine, Clock, X, Wand2, Download, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { RichMarkdownEditor } from "@/components/editor/RichMarkdownEditor";
import { DynamicJsonView } from "./DynamicJsonView";

interface Props {
  projectId: string;
  repoJobId: string | null;
  repoJobStatus: string | null;
  repoJobProgress: number | null;
  canEdit: boolean;
}

type Doc = {
  id: string;
  slug: string;
  filename: string;
  title: string;
  content: string;
  edited: boolean;
  updated_at: string;
  source_bytes: number | null;
};

const EXPECTED_DOC_COUNT = 11;

const DOC_ICONS: Record<string, string> = {
  "00_repo_scan_evidence_summary": "🔍",
  "01_validated_api_surface": "🔌",
  "02_validated_ui_route_map": "🗺️",
  "03_database_schema_inventory": "🗄️",
  "04_env_var_inventory": "🔐",
  "05_selector_and_accessibility_inventory": "♿",
  "06_existing_tests_inventory": "🧪",
  "07_security_and_external_dependency_guide": "🛡️",
  "08_pages": "🖥️",
  "09_testing_data_catalog": "🗂️",
  "10_system_testing_requirements": "📋",
};

export function GeneratedDocsPanel({ projectId, repoJobId, repoJobStatus, repoJobProgress, canEdit }: Props) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [buffer, setBuffer] = useState("");
  const [dirty, setDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const isReady = ["completed", "ready", "succeeded", "success"].includes((repoJobStatus || "").toLowerCase());
  const isRunning = !isReady && !!repoJobId && !["failed", "error"].includes((repoJobStatus || "").toLowerCase());

  // Poll job while running, then sync docs
  useEffect(() => {
    if (!repoJobId) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const { data } = await supabase.functions.invoke("repo-reader", {
        body: { action: "job", project_id: projectId },
      });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["generated-docs", projectId] });
      const s = (data?.status || "").toLowerCase();
      if (!["completed", "ready", "succeeded", "success", "failed", "error"].includes(s)) {
        setTimeout(tick, 3500);
      }
    };
    if (!isReady && isRunning) tick();
  }, [repoJobId, isReady, isRunning, projectId, qc]);

  const docsQ = useQuery({
    queryKey: ["generated-docs", projectId],
    queryFn: async (): Promise<Doc[]> => {
      const { data, error } = await supabase
        .from("project_generated_docs")
        .select("id, slug, filename, title, content, edited, updated_at, source_bytes")
        .eq("project_id", projectId)
        .order("slug", { ascending: true });
      if (error) throw error;
      return (data || []) as Doc[];
    },
    refetchInterval: isReady && !docsQ_hasData() ? 4000 : false,
  });
  function docsQ_hasData() {
    try { return (qc.getQueryData<Doc[]>(["generated-docs", projectId])?.length ?? 0) >= EXPECTED_DOC_COUNT; } catch { return false; }
  }

  const selected = useMemo(
    () => docsQ.data?.find((d) => d.id === selectedId) || null,
    [docsQ.data, selectedId]
  );

  useEffect(() => {
    if (selected) { setBuffer(selected.content); setDirty(false); }
  }, [selected?.id]);

  const resync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("repo-reader", {
        body: { action: "docs-sync", project_id: projectId },
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["generated-docs", projectId] });
      toast.success("Documents refreshed");
    } catch (e: any) {
      toast.error(e.message || "Sync failed");
    } finally { setSyncing(false); }
  };

  const extract = async () => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-from-generated-docs", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      const d: any = data || {};
      toast.success(
        `Extracted ${d.endpoints_inserted ?? 0} endpoints, ${d.test_cases_inserted ?? 0} test cases, ${d.requirements_inserted ?? 0} requirements`,
      );
      qc.invalidateQueries({ queryKey: ["api-endpoints"] });
      qc.invalidateQueries({ queryKey: ["test-cases"] });
      qc.invalidateQueries({ queryKey: ["requirements"] });
    } catch (e: any) {
      toast.error(e.message || "Extraction failed");
    } finally { setExtracting(false); }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const { error } = await supabase
        .from("project_generated_docs")
        .update({ content: buffer, edited: true, edited_by: (await supabase.auth.getUser()).data.user?.id })
        .eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["generated-docs", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!repoJobId) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <div className="font-medium mb-1">No AI documents yet</div>
          <div>Link a GitHub repository to this project to generate technical documentation.</div>
        </CardContent>
      </Card>
    );
  }

  if (isRunning || (isReady && (docsQ.data?.length ?? 0) === 0)) {
    return (
      <Card className="overflow-hidden border-accent/20 relative">
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 0%, hsl(var(--accent) / 0.35) 0%, transparent 60%)",
          }}
        />
        <CardContent className="relative py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 border border-accent/30 mb-4 relative">
            <Loader2 className="h-7 w-7 animate-spin text-accent" />
            <div className="absolute inset-0 rounded-full animate-ping bg-accent/20" />
          </div>
          <div className="text-lg font-semibold mb-1">Generating {EXPECTED_DOC_COUNT} technical documents…</div>
          <div className="text-xs text-muted-foreground mb-4">
            Status: <span className="text-accent font-mono">{repoJobStatus || "queued"}</span>
            {repoJobProgress != null ? <> · {repoJobProgress}%</> : null}
          </div>
          <div className="max-w-md mx-auto h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent via-primary to-accent transition-all duration-1000"
              style={{ width: `${repoJobProgress ?? 15}%` }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isReady) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Repo clone failed: {repoJobStatus || "unknown"}
        </CardContent>
      </Card>
    );
  }

  const docs = docsQ.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" />
            AI-Generated Documentation
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {docs.length} documents generated from your repository · click any card to view or edit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={resync} disabled={syncing}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Resync
          </Button>
          <Button
            size="sm"
            className="ai-gradient text-white"
            onClick={extract}
            disabled={extracting || docs.length === 0}
            title="Extract endpoints, test cases, and requirements from the 4 testing docs (10–13)"
          >
            {extracting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
            Extract endpoints, tests & requirements
          </Button>
        </div>
      </div>

      {/* Card grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {docs.map((d, i) => {
          const icon = DOC_ICONS[d.slug] || "📄";
          const active = selectedId === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              style={{ animationDelay: `${i * 45}ms` }}
              className={cn(
                "group relative text-left rounded-xl p-4 border transition-all duration-300 animate-fade-in",
                "hover:scale-[1.03] hover:-translate-y-0.5 will-change-transform",
                "hover:shadow-[0_10px_40px_-10px_hsl(var(--accent)/0.4)]",
                active
                  ? "border-accent bg-accent/10 shadow-[0_10px_40px_-10px_hsl(var(--accent)/0.5)]"
                  : "border-border bg-card hover:border-accent/50"
              )}
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 pointer-events-none",
                  active && "opacity-100"
                )}
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--accent) / 0.08), transparent 60%)",
                }}
              />
              <div className="relative flex items-start justify-between mb-3">
                <div className="text-2xl">{icon}</div>
                {d.edited && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-accent/40 text-accent">
                    <PencilLine className="h-2.5 w-2.5 mr-0.5" /> edited
                  </Badge>
                )}
              </div>
              <div className="relative">
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  {d.slug.split("_").slice(0, 1)}
                </div>
                <div className="font-semibold text-sm leading-tight line-clamp-2 mb-2">{d.title}</div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-2.5 w-2.5" />
                    {((d.source_bytes ?? d.content.length) / 1024).toFixed(1)} KB
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 transition-transform duration-300",
                      active ? "translate-x-0.5 text-accent" : "group-hover:translate-x-0.5"
                    )}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Editor drawer */}
      {selected && (
        <Card className="animate-fade-in border-accent/20 overflow-hidden">
          <div
            className="px-4 py-3 border-b bg-gradient-to-r from-accent/10 via-primary/5 to-transparent flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-2xl shrink-0">{DOC_ICONS[selected.slug] || "📄"}</div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{selected.title}</div>
                <div className="text-[10px] font-mono text-muted-foreground truncate">
                  {selected.filename}
                </div>
              </div>
              {dirty && (
                <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500 ml-2">
                  <Clock className="h-2.5 w-2.5 mr-0.5" /> unsaved
                </Badge>
              )}
              {selected.edited && !dirty && (
                <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-500 ml-2">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> edited
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const isJson = /\.json$/i.test(selected.filename) || /\.json$/i.test(selected.slug);
                if (isJson) return null;
                return canEdit ? (
                  <Button
                    size="sm"
                    className="ai-gradient text-white"
                    onClick={() => save.mutate()}
                    disabled={save.isPending || !dirty}
                  >
                    {save.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1" />
                    )}
                    Save
                  </Button>
                ) : null;
              })()}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardContent className="p-3">
            {(() => {
              const isJson = /\.json$/i.test(selected.filename) || /\.json$/i.test(selected.slug);
              if (isJson) {
                const raw = buffer || selected.content || "null";
                const tooBig = raw.length > 5_000_000; // 5MB
                if (tooBig) {
                  return (
                    <div className="space-y-2 text-xs">
                      <div className="p-3 rounded border border-amber-500/30 bg-amber-500/5 text-amber-300">
                        This document is very large ({(raw.length / 1024 / 1024).toFixed(1)} MB) — rendering it as an
                        interactive view would freeze the browser. Showing a raw preview of the first 100 KB instead.
                      </div>
                      <pre className="max-h-[500px] overflow-auto p-3 rounded bg-muted/30 border border-border/40 font-mono text-[11px] whitespace-pre-wrap break-all">
                        {raw.slice(0, 100_000)}
                        {raw.length > 100_000 ? "\n\n… truncated …" : ""}
                      </pre>
                    </div>
                  );
                }
                let parsed: unknown = null;
                let parseError: string | null = null;
                try {
                  parsed = JSON.parse(raw);
                } catch (e: any) {
                  parseError = e.message;
                }
                if (parseError) {
                  return (
                    <div className="text-xs text-destructive p-3 rounded border border-destructive/30 bg-destructive/5">
                      Failed to parse JSON: {parseError}
                    </div>
                  );
                }
                return <DynamicJsonView json={parsed} filename={selected.filename} />;
              }
              return (
                <RichMarkdownEditor
                  value={buffer}
                  onChange={(md) => { setBuffer(md); setDirty(true); }}
                  editable={canEdit}
                  placeholder="Start writing…"
                />
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
