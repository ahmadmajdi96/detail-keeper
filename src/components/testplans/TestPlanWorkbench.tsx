import { useEffect, useMemo, useRef, useState } from "react";

import Editor from "@monaco-editor/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  FileText, FileCode2, Play, Save, Sparkles, Wand2, Loader2, X, Lock,
  ListChecks, FolderTree, Rocket, Settings2,
} from "lucide-react";
import { SpecRunPanel } from "./SpecRunPanel";
import { SuiteRunProgress } from "./SuiteRunProgress";
import { ArtifactViewer } from "./ArtifactViewer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Doc = { id: string; slug: string; title: string; kind: string; content: string; sort_order: number };
type Spec = { id: string; filename: string; content: string; document_id: string | null; test_case_id: string | null };
type TCRow = { test_case: { id: string; title: string; priority: number } };
type OpenFile =
  | { kind: "doc"; id: string; label: string }
  | { kind: "spec"; id: string; label: string };

interface Props { testPlanId: string; projectId: string }

export function TestPlanWorkbench({ testPlanId, projectId }: Props) {
  const qc = useQueryClient();
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Persisted "in-flight" generation lock. Kept in localStorage so a refresh
  // still shows the lock, and so we can guard navigation while a generation
  // request is pending (edge-function invokes are aborted on navigation).
  type BusyKind = "docs" | "cases" | "code" | "suite";
  const busyKey = `wb-busy-${testPlanId}`;
  const busyLabels: Record<BusyKind, string> = {
    docs: "Generating documents",
    cases: "Generating test cases",
    code: "Generating Playwright code",
    suite: "Dispatching suite run",
  };
  const readBusy = (): { kind: BusyKind; startedAt: number } | null => {
    try {
      const raw = localStorage.getItem(busyKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Auto-expire stale locks after 20 minutes so a hard crash can't lock forever.
      if (!parsed?.kind || Date.now() - parsed.startedAt > 20 * 60 * 1000) {
        localStorage.removeItem(busyKey);
        return null;
      }
      return parsed;
    } catch { return null; }
  };
  const [busy, setBusyState] = useState<BusyKind | null>(() => readBusy()?.kind ?? null);
  const setBusy = (kind: BusyKind | null) => {
    if (kind) localStorage.setItem(busyKey, JSON.stringify({ kind, startedAt: Date.now() }));
    else localStorage.removeItem(busyKey);
    setBusyState(kind);
  };
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  // Note: no navigation guards. Generations run server-side (edge function
  // background task) and are tracked globally by <GenerationJobTracker /> —
  // the user is free to navigate away while a job is in flight.



  const cfgKey = `wb-cfg-${testPlanId}`;
  const initialCfg = (() => { try { return JSON.parse(localStorage.getItem(cfgKey) || "{}"); } catch { return {}; } })();
  const [browser, setBrowser] = useState<string>(initialCfg.browser || "chromium");
  const [headless, setHeadless] = useState<boolean>(initialCfg.headless ?? true);
  const [retries, setRetries] = useState<number>(initialCfg.retries ?? 0);
  const [activeSuiteRunId, setActiveSuiteRunId] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem(cfgKey, JSON.stringify({ browser, headless, retries })); }, [cfgKey, browser, headless, retries]);

  const { data: docs = [] } = useQuery<Doc[]>({
    queryKey: ["tp-docs", testPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_plan_documents_v2" as any)
        .select("*").eq("test_plan_id", testPlanId).order("sort_order");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const { data: specs = [] } = useQuery<Spec[]>({
    queryKey: ["tp-specs", testPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_plan_specs" as any)
        .select("*").eq("test_plan_id", testPlanId).order("filename");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const { data: caseRows = [] } = useQuery<TCRow[]>({
    queryKey: ["tp-wb-cases", testPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_plan_test_cases")
        .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, priority)")
        .eq("test_plan_id", testPlanId);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
  const cases = caseRows.map(r => r.test_case).filter(Boolean);

  // Live progress row driven by the background AI job. React-query cache is
  // kept fresh by GenerationJobTracker + realtime, so this stays in sync.
  const { data: planProgress } = useQuery({
    queryKey: ["tp-progress", testPlanId],
    queryFn: async () => {
      const { data } = await supabase
        .from("test_plans")
        .select("ai_status, ai_progress, ai_progress_message")
        .eq("id", testPlanId)
        .maybeSingle();
      return data as any;
    },
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.ai_status;
      return (s === "running" || s === "queued") ? 4000 : false;
    },
  });

  useEffect(() => {
    if (!testPlanId) return;
    // Hardened: unique channel name per mount, scoped strictly to this plan
    // (test_plan_id is itself project-scoped). Always tear down on unmount /
    // plan switch to prevent duplicated invalidations.
    const tag = `${testPlanId}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase
      .channel(`tp-wb-${tag}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "test_plan_documents_v2", filter: `test_plan_id=eq.${testPlanId}` },
        () => qc.invalidateQueries({ queryKey: ["tp-docs", testPlanId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "test_plan_specs", filter: `test_plan_id=eq.${testPlanId}` },
        () => qc.invalidateQueries({ queryKey: ["tp-specs", testPlanId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "test_plan_test_cases", filter: `test_plan_id=eq.${testPlanId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["tp-wb-cases", testPlanId] });
          qc.invalidateQueries({ queryKey: ["test-plan-cases", testPlanId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [testPlanId, projectId, qc]);

  const fileKey = (f: OpenFile) => `${f.kind}:${f.id}`;
  const openFile = (f: OpenFile) => {
    setOpenFiles(prev => prev.find(p => fileKey(p) === fileKey(f)) ? prev : [...prev, f]);
    setActiveKey(fileKey(f));
  };
  const closeFile = (key: string) => {
    setOpenFiles(prev => {
      const next = prev.filter(p => fileKey(p) !== key);
      if (activeKey === key) setActiveKey(next[0] ? fileKey(next[0]) : null);
      return next;
    });
    setDrafts(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const currentContent = useMemo(() => {
    if (!activeKey) return "";
    if (drafts[activeKey] !== undefined) return drafts[activeKey];
    const [kind, id] = activeKey.split(":");
    const src = kind === "doc" ? docs.find(d => d.id === id)?.content : specs.find(s => s.id === id)?.content;
    return src ?? "";
  }, [activeKey, drafts, docs, specs]);

  const currentFile = openFiles.find(f => fileKey(f) === activeKey);
  const isDirty = activeKey ? drafts[activeKey] !== undefined : false;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!activeKey) return;
      const [kind, id] = activeKey.split(":");
      const table = kind === "doc" ? "test_plan_documents_v2" : "test_plan_specs";
      const { error } = await supabase.from(table as any).update({ content: drafts[activeKey] }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      if (activeKey) setDrafts(prev => { const n = { ...prev }; delete n[activeKey]; return n; });
      qc.invalidateQueries({ queryKey: ["tp-docs", testPlanId] });
      qc.invalidateQueries({ queryKey: ["tp-specs", testPlanId] });
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  async function runStep(step: "docs" | "cases" | "code", fn: string, body: any, label: string) {
    setBusy(step);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      const detail = data?.status === "queued"
        ? ` — queued ${data.queued} (streaming in via realtime)`
        : data?.cases ? ` — ${data.cases} cases`
        : data?.specs ? ` — ${data.specs} specs`
        : data?.documents?.length ? ` — ${data.documents.length} docs` : "";
      toast.success(label + detail);
      qc.invalidateQueries({ queryKey: ["tp-docs", testPlanId] });
      qc.invalidateQueries({ queryKey: ["tp-specs", testPlanId] });
      qc.invalidateQueries({ queryKey: ["tp-wb-cases", testPlanId] });
      qc.invalidateQueries({ queryKey: ["test-plan-cases", testPlanId] });
    } catch (e: any) {
      toast.error(e.message || "Step failed");
    } finally { setBusy(null); }
  }

  const runSuite = async () => {
    if (specs.length === 0) { toast.error("No specs to run"); return; }
    setBusy("suite");
    try {
      // Create parent suite_run with chosen config
      const projectId2 = (specs[0] as any)?.project_id || projectId;
      const { data: suite, error: sErr } = await supabase.from("suite_runs" as any).insert({
        test_plan_id: testPlanId, project_id: projectId2,
        browser, headless, retries,
        config_json: { browser, headless, retries, spec_count: specs.length },
        total_specs: specs.length,
      }).select("id").single();
      if (sErr) throw sErr;
      const suiteRunId = (suite as any).id as string;
      setActiveSuiteRunId(suiteRunId);

      let ok = 0;
      for (const s of specs) {
        const { error } = await supabase.functions.invoke("spec-run-dispatch", {
          body: { spec_id: s.id, suite_run_id: suiteRunId, browser, headless, retries },
        });
        if (!error) ok++;
      }
      toast.success(`Dispatched ${ok}/${specs.length} specs · live progress below`);
      qc.invalidateQueries({ queryKey: ["spec-runs"] });
      qc.invalidateQueries({ queryKey: ["suite-spec-runs", suiteRunId] });
    } catch (e: any) {
      toast.error(e.message || "Suite run failed");
    } finally { setBusy(null); }
  };

  const runSpec = async () => {
    if (!currentFile || currentFile.kind !== "spec") return;
    try {
      const { error } = await supabase.functions.invoke("spec-run-dispatch", {
        body: { spec_id: currentFile.id, browser, headless, retries },
      });
      if (error) throw error;
      toast.success("Spec dispatched");
    } catch (e: any) {
      toast.error(e.message || "Run failed");
    }
  };

  // Group specs by test case
  const specsByCase = new Map<string, Spec[]>();
  const unlinkedSpecs: Spec[] = [];
  specs.forEach(s => {
    if (s.test_case_id) {
      if (!specsByCase.has(s.test_case_id)) specsByCase.set(s.test_case_id, []);
      specsByCase.get(s.test_case_id)!.push(s);
    } else unlinkedSpecs.push(s);
  });

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-accent" /> AI Workbench
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={busy !== null}
            title="Sends plan documents + variable sets to testgenerator.qualixa.cortanexai.com"
            onClick={() => runStep("cases", "tp-forge-generate", { test_plan_id: testPlanId }, "Generated test cases")}>
            {busy === "cases" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ListChecks className="h-3.5 w-3.5 mr-1" />}
            1. Generate Test Cases
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null || cases.length === 0}
            title={cases.length === 0 ? "Generate test cases first" : ""}
            onClick={() => runStep("code", "tp-generate-code", { test_plan_id: testPlanId }, "Generated Playwright code")}>
            {busy === "code" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileCode2 className="h-3.5 w-3.5 mr-1" />}
            2. Generate Playwright Code
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" disabled={busy !== null || specs.length === 0}
                className="bg-accent text-accent-foreground hover:bg-accent/90">
                {busy === "suite" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Rocket className="h-3.5 w-3.5 mr-1" />}
                Run Suite ({specs.length})
                <Settings2 className="h-3 w-3 ml-1.5 opacity-70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <div className="text-xs font-semibold flex items-center gap-1"><Settings2 className="h-3 w-3" /> Run configuration</div>
              <div className="space-y-1.5">
                <Label className="text-xs">Browser</Label>
                <Select value={browser} onValueChange={setBrowser}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chromium">Chromium</SelectItem>
                    <SelectItem value="firefox">Firefox</SelectItem>
                    <SelectItem value="webkit">WebKit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="hl" className="text-xs">Headless</Label>
                <Switch id="hl" checked={headless} onCheckedChange={setHeadless} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Retries</Label>
                <Input type="number" min={0} max={5} value={retries} className="h-8"
                  onChange={(e) => setRetries(Math.max(0, Math.min(5, parseInt(e.target.value) || 0)))} />
              </div>
              <Button size="sm" className="w-full" onClick={runSuite} disabled={busy !== null}>
                <Rocket className="h-3.5 w-3.5 mr-1" /> Dispatch suite
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {busy && (
        <div className="flex items-center gap-2 border-b border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
          <Lock className="h-3.5 w-3.5" />
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="font-medium">{busyLabels[busy]} — please keep this tab open.</span>
          <span className="text-accent/70">Navigation is blocked until this completes.</span>
        </div>
      )}

      <div className="grid grid-cols-12 min-h-[600px]">
        <aside className="col-span-3 border-r border-border/50 bg-muted/10">
          <ScrollArea className="h-[600px]">
            <div className="p-3 space-y-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Documents ({docs.length}/20)
                </div>
                {docs.length === 0 && <p className="text-xs text-muted-foreground">Generate documents from the Test Plan page to populate the 20 files.</p>}
                <div className="space-y-0.5">
                  {docs.map(d => (
                    <button key={d.id}
                      onClick={() => openFile({ kind: "doc", id: d.id, label: `${d.slug}.md` })}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/50 truncate">
                      <span className="text-muted-foreground">📄</span> {d.slug}.md
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <FolderTree className="h-3 w-3" /> Test Cases &amp; Specs ({cases.length})
                </div>
                {cases.length === 0 && <p className="text-xs text-muted-foreground">Run step 2 to generate.</p>}
                <div className="space-y-1">
                  {cases.map(c => {
                    const caseSpecs = specsByCase.get(c.id) || [];
                    return (
                      <div key={c.id} className="space-y-0.5">
                        <div className="text-[11px] px-2 py-1 text-foreground truncate">
                          <span className="text-accent">🧪</span> {c.title}
                          <span className="ml-1 text-muted-foreground">P{c.priority}</span>
                        </div>
                        {caseSpecs.map(s => (
                          <button key={s.id}
                            onClick={() => openFile({ kind: "spec", id: s.id, label: s.filename })}
                            className="w-full text-left text-xs pl-6 pr-2 py-1 rounded hover:bg-muted/50 truncate">
                            <span className="text-cyan-400">⚡</span> {s.filename}
                          </button>
                        ))}
                        {caseSpecs.length === 0 && (
                          <div className="text-[10px] pl-6 text-muted-foreground italic">no spec yet — run step 3</div>
                        )}
                      </div>
                    );
                  })}
                  {unlinkedSpecs.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-border/30">
                      <div className="text-[10px] text-muted-foreground uppercase mb-1">Other specs</div>
                      {unlinkedSpecs.map(s => (
                        <button key={s.id}
                          onClick={() => openFile({ kind: "spec", id: s.id, label: s.filename })}
                          className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/50 truncate">
                          <span className="text-cyan-400">⚡</span> {s.filename}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        <section className="col-span-9 flex flex-col">
          <div className="flex items-center border-b border-border/50 bg-muted/20 overflow-x-auto">
            {openFiles.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Open a file from the sidebar to edit.</div>
            )}
            {openFiles.map(f => {
              const key = fileKey(f);
              const dirty = drafts[key] !== undefined;
              return (
                <div key={key}
                  onClick={() => setActiveKey(key)}
                  className={`group flex items-center gap-1 px-3 py-2 text-xs border-r border-border/50 cursor-pointer ${activeKey === key ? "bg-background" : "hover:bg-muted/30"}`}>
                  <span>{f.label}</span>
                  {dirty && <span className="text-amber-400">•</span>}
                  <button onClick={(e) => { e.stopPropagation(); closeFile(key); }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-muted rounded p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <div className="flex-1" />
            {currentFile && (
              <div className="flex items-center gap-1 pr-2">
                <Button size="sm" variant="ghost" disabled={!isDirty || saveMut.isPending}
                  onClick={() => saveMut.mutate()}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
                {currentFile.kind === "spec" && (
                  <Button size="sm" onClick={runSpec}>
                    <Play className="h-3.5 w-3.5 mr-1" /> Run
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[400px]">
            {currentFile ? (
              <Editor
                height="400px"
                language={currentFile.kind === "spec" ? "typescript" : "markdown"}
                theme="vs-dark"
                value={currentContent}
                onChange={(v) => activeKey && setDrafts(prev => ({ ...prev, [activeKey]: v ?? "" }))}
                options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on", scrollBeyondLastLine: false }}
              />
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
                Select a file from the left sidebar.
              </div>
            )}
          </div>

          {currentFile?.kind === "spec" && (
            <SpecRunPanel specId={currentFile.id} />
          )}
        </section>
      </div>

      {activeSuiteRunId && <SuiteRunProgress suiteRunId={activeSuiteRunId} projectId={projectId} />}

      <div className="p-3 border-t border-border/50">
        <ArtifactViewer testPlanId={testPlanId} />
      </div>
    </div>
  );
}
