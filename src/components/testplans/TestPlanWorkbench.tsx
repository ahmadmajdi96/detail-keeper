import { useEffect, useMemo, useRef, useState } from "react";

import Editor from "@monaco-editor/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  FileText, FileCode2, Play, Save, Sparkles, Wand2, Loader2, X, Lock,
  ListChecks, FolderTree, Rocket, Settings2, Package, ShieldOff, ShieldCheck, GitBranch,
} from "lucide-react";
import { SpecRunPanel } from "./SpecRunPanel";
import { ForgeRunProgress } from "./ForgeRunProgress";
import { ArtifactViewer } from "./ArtifactViewer";
import { FileIcon, fileLanguage } from "@/lib/fileIcons";
import { exportWorkflowBundle } from "@/lib/exportWorkflowBundle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, FolderOpen, FlaskConical, FileSearch, Search } from "lucide-react";
import { resolveTestType } from "./PlanTestCasesPanel";
import { CoverageSummary } from "./CoverageSummary";
import { GenerationSettingsPanel, useGenerationSettings, limitLabel } from "./GenerationSettingsPanel";
import { GenerationStatusStrip } from "./GenerationStatusStrip";
import { TestCaseCatalogPanel } from "./TestCaseCatalogPanel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReviewQueue, type ReviewKind } from "./ReviewQueue";

import { DocVersionHistory } from "./DocVersionHistory";
import { TraceabilityMatrixEditor } from "./TraceabilityMatrixEditor";
import { SpecValidationPanel } from "./SpecValidationPanel";
import { ProvenancePanel } from "./ProvenancePanel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClipboardCheck, History, Grid3x3 } from "lucide-react";

type ConfirmButtonProps = {
  size?: "sm" | "default"; variant?: "outline" | "default";
  disabled?: boolean; title?: string; label: string; icon: React.ReactNode;
  confirmTitle: string; confirmDescription: string; confirmLabel: string;
  onConfirm: () => void;
};
function ConfirmButton({
  size = "sm", variant = "outline", disabled, title, label, icon,
  confirmTitle, confirmDescription, confirmLabel, onConfirm,
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size={size} variant={variant} disabled={disabled} title={title}>
          {icon}{label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type Doc = { id: string; slug: string; title: string; kind: string; content: string; sort_order: number };
type Spec = { id: string; filename: string; content: string; document_id: string | null; test_case_id: string | null };
type TCase = { id: string; title: string; priority: number; test_type: string | null; priority_score: number | null; suite_id: string | null };
type TCRow = { test_case: TCase };
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
  const [baseUrl, setBaseUrl] = useState<string>(initialCfg.baseUrl || "");
  // Suite scoping: "all" generates code for every test case, otherwise only
  // the selected suite's cases are sent to Repo Reader.
  const [codegenSuite, setCodegenSuite] = useState<string>(initialCfg.codegenSuite || "all");
  const [runSuiteId, setRunSuiteId] = useState<string>(initialCfg.runSuiteId || "all");
  const [activePlanRunId, setActivePlanRunId] = useState<string | null>(null);
  useEffect(() => { localStorage.setItem(cfgKey, JSON.stringify({ browser, headless, retries, baseUrl, codegenSuite, runSuiteId })); }, [cfgKey, browser, headless, retries, baseUrl, codegenSuite, runSuiteId]);

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
        .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, priority, test_type, priority_score, suite_id)")
        .eq("test_plan_id", testPlanId);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });
  const cases = caseRows.map(r => r.test_case).filter(Boolean);

  const [caseQuery, setCaseQuery] = useState("");
  const TYPE_CLASS: Record<string, string> = {
    smoke: "text-emerald-400", regression: "text-cyan-400", integration: "text-violet-400",
    e2e: "text-fuchsia-400", api: "text-sky-400", ui: "text-amber-400",
    performance: "text-orange-400", security: "text-rose-400", other: "text-muted-foreground",
  };
  const caseTypeGroups = useMemo(() => {
    const needle = caseQuery.trim().toLowerCase();
    const visible = needle ? cases.filter(c => c.title?.toLowerCase().includes(needle)) : cases;
    const map = new Map<string, typeof visible>();
    visible.forEach(c => {
      const t = resolveTestType(c);
      if (!map.has(t)) map.set(t, [] as any);
      (map.get(t) as any).push(c);
    });
    return [...map.entries()]
      .map(([type, list]) => ({
        type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
        cls: TYPE_CLASS[type] ?? "text-muted-foreground",
        list: [...list].sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0) || (a.priority ?? 9) - (b.priority ?? 9)),
      }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [cases, caseQuery]);

  const { data: suites = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["tp-wb-suites", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_suites").select("id, name").eq("project_id", projectId).order("name");
      if (error) throw error;
      return (data ?? []) as any;
    },
    enabled: !!projectId,
  });

  const { settings, patch: patchSettings } = useGenerationSettings(testPlanId);


  // Live progress row driven by the background AI job. React-query cache is
  // kept fresh by GenerationJobTracker + realtime, so this stays in sync.
  const { data: planProgress } = useQuery({
    queryKey: ["tp-progress", testPlanId],
    queryFn: async () => {
      const { data } = await supabase
        .from("test_plans")
        .select("docs_status, docs_progress, docs_progress_message, ai_status, ai_progress, ai_progress_message, codegen_status, codegen_progress, codegen_progress_message, codegen_suite_id")
        .eq("id", testPlanId)
        .maybeSingle();
      return data as any;
    },
    refetchInterval: (q) => {
      const d: any = q.state.data;
      const s = d?.ai_status; const c = d?.codegen_status; const g = d?.docs_status;
      if (g === "running" || g === "queued") return 5000;
      return (s === "running" || s === "queued" || c === "running" || c === "queued") ? 4000 : false;
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "test_plans", filter: `id=eq.${testPlanId}` },
        (payload) => {
          qc.setQueryData(["tp-progress", testPlanId], (old: any) => ({ ...(old || {}), ...(payload.new as any) }));
          qc.invalidateQueries({ queryKey: ["test-plan", testPlanId] });
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

  const [exporting, setExporting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [provenanceOpen, setProvenanceOpen] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [historyDoc, setHistoryDoc] = useState<{ id: string; label: string } | null>(null);
  const exportBundle = async (approvedOnly = false) => {
    setExporting(true);
    const t = toast.loading("Packaging workflow bundle…");
    try {
      const res = await exportWorkflowBundle(testPlanId, (m) => toast.loading(m, { id: t }), { approvedOnly });
      toast.success(
        `Bundle downloaded — ${res.documents} docs · ${res.cases} cases · ${res.specs} specs`,
        { id: t },
      );
    } catch (e: any) {
      toast.error(e.message || "Export failed", { id: t });
    } finally { setExporting(false); }
  };

  const runSuite = async () => {
    if (!baseUrl.trim()) { toast.error("Set a Base URL first (target app under test)"); return; }
    setBusy("suite");
    try {
      const { data, error } = await supabase.functions.invoke("tp-forge-run-start", {
        body: { test_plan_id: testPlanId, base_url: baseUrl.trim() },
      });
      if (error) throw error;
      const id = (data as any)?.plan_test_run_id as string | undefined;
      if (!id) throw new Error("Forge did not return a run id");
      setActivePlanRunId(id);
      toast.success("Suite dispatched to Forge — live progress below");
      qc.invalidateQueries({ queryKey: ["plan-test-runs", testPlanId] });
    } catch (e: any) {
      toast.error(e.message || "Suite run failed");
    } finally { setBusy(null); }
  };

  const runSpec = async () => {
    // Forge executes the whole codegen bundle; a single-spec run reuses the same dispatch.
    await runSuite();
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
          {settings.dryRun && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              <ShieldOff className="h-3 w-3" /> Dry run — no install / no execution
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}
            title="Accept, reject or regenerate each generated artifact in order">
            <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Review Queue
          </Button>
          <Button size="sm" variant="outline" onClick={() => setValidationOpen(true)}
            disabled={specs.length === 0}
            title={specs.length === 0 ? "Generate Playwright code first" : "Format, lint and syntax-check the generated specs"}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Validate Code
          </Button>
          <Button size="sm" variant="outline" onClick={() => setProvenanceOpen(true)}
            title="See which document versions and traceability mappings produced each artifact">
            <GitBranch className="h-3.5 w-3.5 mr-1" /> Provenance
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMatrixOpen(true)}
            title="Edit requirement ⇄ test-case mappings">
            <Grid3x3 className="h-3.5 w-3.5 mr-1" /> Traceability
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCatalogOpen(true)}
            title="Browse the generated test-case catalog with filters">
            <FlaskConical className="h-3.5 w-3.5 mr-1" /> Catalog
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={exporting}
                title="Download docs, plan, test cases and Playwright specs as one ZIP with a manifest">
                {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Package className="h-3.5 w-3.5 mr-1" />}
                Export Bundle
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportBundle(false)}>All generated artifacts</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportBundle(true)}>Approved artifacts only</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <GenerationSettingsPanel settings={settings} onChange={patchSettings} disabled={busy !== null} />

          {(() => {
            const casesRunning = busy === "cases" || planProgress?.ai_status === "running" || planProgress?.ai_status === "queued";
            const codeRunning = busy === "code" || planProgress?.codegen_status === "running" || planProgress?.codegen_status === "queued";
            const docsRunning = busy === "docs" || planProgress?.docs_status === "running" || planProgress?.docs_status === "queued";
            const anyRunning = busy !== null || casesRunning || codeRunning || docsRunning;
            const noTypes = !settings.smoke && !settings.regression;
            return <>
          <ConfirmButton
            size="sm" variant="outline" disabled={anyRunning}
            icon={docsRunning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
            label="0. Generate QA Documents"
            title="Builds the SQA testing plan documents from the project's already-ingested documents (no upload needed)"
            confirmTitle={docs.length > 0 ? "Regenerate QA documents?" : "Generate QA documents?"}
            confirmDescription={docs.length > 0
              ? `This plan already has ${docs.length} document${docs.length === 1 ? "" : "s"}. Repo Reader will rebuild the seven SQA documents from the project's completed ingestion job and overwrite files with matching names. Previous versions stay in document history.`
              : "Repo Reader reuses the project's already-ingested documents — nothing is uploaded — and returns the SQA master strategy, testing-types matrix, quality scorecard, test boundaries, manual and automation plans, and execution governance."}
            confirmLabel="Start generation"
            onConfirm={() => runStep("docs", "tp-generate-docs", { test_plan_id: testPlanId }, "Document generation started")}
          />
          <ConfirmButton
            size="sm" variant="outline" disabled={anyRunning || noTypes}
            icon={casesRunning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <ListChecks className="h-3.5 w-3.5 mr-1" />}
            label="1. Generate Test Cases"
            title={noTypes ? "Select at least one test type in Generation Settings" : "Sends plan documents + variable sets to testgenerator.qualixa.cortanexai.com"}
            confirmTitle={cases.length > 0 ? "Regenerate test cases?" : "Generate test cases?"}
            confirmDescription={`${[
              settings.smoke ? `Smoke: max ${limitLabel(settings.maxSmoke)}` : null,
              settings.regression ? `Regression: max ${limitLabel(settings.maxRegression)}` : null,
            ].filter(Boolean).join(" · ")}. ${cases.length > 0
              ? `This plan already has ${cases.length} test case${cases.length === 1 ? "" : "s"}. Running generation again will submit a new ~25 minute job and append newly generated cases. Existing cases are not deleted.`
              : "This will submit plan documents and variable sets to the AI service. Generation typically takes ~25 minutes and cannot be undone once the credits are consumed."}`}
            confirmLabel="Start generation"
            onConfirm={() => runStep("cases", "tp-forge-generate", { test_plan_id: testPlanId, settings, dry_run: settings.dryRun }, "Generation started")}
          />
          <ConfirmButton
            size="sm" variant="outline" disabled={anyRunning || cases.length === 0}
            icon={codeRunning ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <FileCode2 className="h-3.5 w-3.5 mr-1" />}
            label="2. Generate Playwright Code"
            title={cases.length === 0 ? "Generate test cases first" : "Sends test cases + env-var names to the code generator"}
            confirmTitle={specs.length > 0 ? "Regenerate Playwright code?" : "Generate Playwright code?"}
            confirmDescription={specs.length > 0
              ? `This plan already has ${specs.length} spec file${specs.length === 1 ? "" : "s"}. Codegen will submit a new ${settings.language} job and overwrite any files with matching names. Only env-var NAMES (not values) from the Overview variable sets are sent.`
              : `Codegen submits the completed test-generation job together with the env-var NAMES from your variable sets (values are never sent) and returns Playwright ${settings.language} spec files.`}
            confirmLabel="Start codegen"
            onConfirm={() => runStep("code", "tp-forge-codegen", { test_plan_id: testPlanId, language: settings.language, dry_run: settings.dryRun, skip_stubs: settings.skipStubs }, "Codegen started")}
          />
          </>;
          })()}




          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" disabled={busy !== null || specs.length === 0}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                title={specs.length === 0 ? "Generate Playwright code first" : "Execute suite via TestCase Forge"}>
                {busy === "suite" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Rocket className="h-3.5 w-3.5 mr-1" />}
                Run Suite ({specs.length})
                <Settings2 className="h-3 w-3 ml-1.5 opacity-70" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-3">
              <div className="text-xs font-semibold flex items-center gap-1"><Settings2 className="h-3 w-3" /> Forge run configuration</div>
              <div className="space-y-1.5">
                <Label className="text-xs">Base URL <span className="text-red-400">*</span></Label>
                <Input placeholder="https://staging.myapp.com" value={baseUrl}
                  className="h-8 font-mono text-xs"
                  onChange={(e) => setBaseUrl(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Target app the Playwright suite will hit. Env variable values from your variable sets are sent to Forge in-memory (never stored).</p>
              </div>
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
              <Button size="sm" className="w-full" onClick={runSuite} disabled={busy !== null || !baseUrl.trim()}>
                <Rocket className="h-3.5 w-3.5 mr-1" /> Dispatch to Forge
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <GenerationStatusStrip
        testPlanId={testPlanId}
        jobs={[
          {
            kind: "docs",
            status: busy === "docs" && !planProgress?.docs_status ? "running" : planProgress?.docs_status,
            progress: planProgress?.docs_progress,
            message: planProgress?.docs_progress_message,
          },
          {
            kind: "cases",
            status: busy === "cases" && !planProgress?.ai_status ? "running" : planProgress?.ai_status,
            progress: planProgress?.ai_progress,
            message: planProgress?.ai_progress_message,
          },
          {
            kind: "code",
            status: busy === "code" && !planProgress?.codegen_status ? "running" : planProgress?.codegen_status,
            progress: planProgress?.codegen_progress,
            message: planProgress?.codegen_progress_message,
          },
        ]}
      />



      <div className="grid grid-cols-12 min-h-[600px]">
        <aside className="col-span-3 border-r border-border/50 bg-muted/10">
          <ScrollArea className="h-[600px]">
            <div className="p-2 space-y-1">
              <WBFolder icon={<FileSearch className="h-3.5 w-3.5 text-accent" />} label="Analysis" count={null} defaultOpen>
                <CoverageSummary projectId={projectId} testPlanId={testPlanId} />
              </WBFolder>

              <WBFolder icon={<FileText className="h-3.5 w-3.5 text-violet-400" />} label="Documentation" count={docs.length}>
                {docs.length === 0
                  ? <p className="text-[11px] text-muted-foreground px-1">No QA documents yet — generate them from the Test Plan page.</p>
                  : docs.map(d => (
                    <div key={d.id} className="group flex items-center gap-1 rounded hover:bg-muted/50">
                      <button
                        onClick={() => openFile({ kind: "doc", id: d.id, label: `${d.slug}.md` })}
                        className="flex-1 text-left text-xs px-2 py-1 truncate">
                        <span className="inline-flex items-center gap-1.5"><FileIcon name={`${d.slug}.md`} /> {d.slug}.md</span>
                      </button>
                      <button
                        title="Version history & diff"
                        onClick={() => setHistoryDoc({ id: d.id, label: `${d.slug}.md` })}
                        className="mr-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-accent group-hover:opacity-100">
                        <History className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </WBFolder>

              <WBFolder icon={<FolderTree className="h-3.5 w-3.5 text-cyan-400" />} label="Test Suites" count={suites.length}>
                {suites.length === 0
                  ? <p className="text-[11px] text-muted-foreground px-1">Suites are created automatically during generation.</p>
                  : suites.map(s => {
                    const n = cases.filter(c => c.suite_id === s.id).length;
                    return (
                      <div key={s.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-muted/50">
                        <FolderOpen className="h-3 w-3 text-cyan-400/70" />
                        <span className="truncate flex-1">{s.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{n}</span>
                      </div>
                    );
                  })}
              </WBFolder>

              <WBFolder icon={<FlaskConical className="h-3.5 w-3.5 text-emerald-400" />} label="Test Cases" count={cases.length} defaultOpen>
                {cases.length === 0 && <p className="text-[11px] text-muted-foreground px-1">Run step 1 to generate test cases.</p>}
                {cases.length > 0 && (
                  <div className="relative px-1 pb-1">
                    <Search className="pointer-events-none absolute left-2.5 top-2 h-3 w-3 text-muted-foreground" />
                    <Input value={caseQuery} onChange={(e) => setCaseQuery(e.target.value)}
                      placeholder="Filter test cases…" className="h-7 pl-7 text-[11px]" />
                  </div>
                )}
                {caseTypeGroups.map(({ type, label, cls, list }) => (
                  <WBSubGroup key={type} label={label} count={list.length} className={cls} defaultOpen={caseTypeGroups.length <= 2}>
                      {list.map(c => {
                        const caseSpecs = specsByCase.get(c.id) || [];
                        if (caseSpecs.length === 0) {
                          return (
                            <div key={c.id} className="flex items-center gap-1.5 text-[11px] px-2 py-1 truncate">
                              <span className="text-accent">🧪</span>
                              <span className="truncate flex-1">{c.title}</span>
                              {typeof c.priority_score === "number" && (
                                <span className="font-mono text-[10px] text-muted-foreground">{c.priority_score}</span>
                              )}
                              <span className="text-[10px] text-muted-foreground">P{c.priority}</span>
                            </div>
                          );
                        }
                        return (
                          <WBSubGroup
                            key={c.id}
                            label={c.title}
                            count={caseSpecs.length}
                            icon={<span className="text-accent">🧪</span>}
                            className="text-foreground normal-case tracking-normal"
                            trailing={<span className="text-[10px] text-muted-foreground">P{c.priority}</span>}
                          >
                            {caseSpecs.map(s => (
                              <button key={s.id}
                                onClick={() => openFile({ kind: "spec", id: s.id, label: s.filename })}
                                className="w-full text-left text-xs pl-4 pr-2 py-1 rounded hover:bg-muted/50 truncate">
                                <span className="inline-flex items-center gap-1.5"><FileIcon name={s.filename} /> {s.filename}</span>
                              </button>
                            ))}
                          </WBSubGroup>
                        );
                      })}
                  </WBSubGroup>
                ))}
                {cases.length > 0 && caseTypeGroups.length === 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground">No test cases match “{caseQuery}”.</p>
                )}
              </WBFolder>


              <WBFolder icon={<FileCode2 className="h-3.5 w-3.5 text-amber-400" />} label="Automation" count={specs.length}>
                {specs.length === 0 && <p className="text-[11px] text-muted-foreground px-1">Run step 2 to generate Playwright code.</p>}
                {["pages", "tests", "fixtures", "utils", "root"].map(folder => {
                  const list = specs.filter(s => {
                    const parts = s.filename.split("/");
                    const dir = parts.length > 1 ? parts[0] : "root";
                    return dir === folder;
                  });
                  if (list.length === 0) return null;
                  return (
                    <div key={folder} className="pt-1">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide px-2 pb-0.5 text-muted-foreground">
                        <FolderOpen className="h-3 w-3" /> {folder} ({list.length})
                      </div>
                      {list.map(s => (
                        <button key={s.id}
                          onClick={() => openFile({ kind: "spec", id: s.id, label: s.filename })}
                          className="w-full text-left text-xs pl-7 pr-2 py-1 rounded hover:bg-muted/50 truncate">
                          <span className="inline-flex items-center gap-1.5"><FileIcon name={s.filename} /> {s.filename.split("/").pop()}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </WBFolder>
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
                language={fileLanguage(currentFile.label)}
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

      {activePlanRunId && <ForgeRunProgress planRunId={activePlanRunId} onClose={() => setActivePlanRunId(null)} />}

      <div className="p-3 border-t border-border/50">
        <ArtifactViewer testPlanId={testPlanId} />
      </div>

      <SpecValidationPanel testPlanId={testPlanId} open={validationOpen} onOpenChange={setValidationOpen} />
      <ProvenancePanel testPlanId={testPlanId} open={provenanceOpen} onOpenChange={setProvenanceOpen} />

      <ReviewQueue
        testPlanId={testPlanId}
        projectId={projectId}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        regenerating={busy !== null}
        onRegenerate={(kind: ReviewKind) => {
          if (kind === "doc") {
            runStep("docs", "tp-generate-docs", { test_plan_id: testPlanId, settings }, "Document generation started");
          } else if (kind === "case") {
            runStep("cases", "tp-forge-generate", { test_plan_id: testPlanId, settings, dry_run: settings.dryRun }, "Generation started");
          } else if (kind === "spec") {
            runStep("code", "tp-forge-codegen", {
              test_plan_id: testPlanId, language: settings.language,
              dry_run: settings.dryRun, skip_stubs: settings.skipStubs,
            }, "Codegen started");
          }
        }}
      />

      {historyDoc && (
        <DocVersionHistory
          documentId={historyDoc.id}
          documentLabel={historyDoc.label}
          open={!!historyDoc}
          onOpenChange={(o) => !o && setHistoryDoc(null)}
        />
      )}

      <TestCaseCatalogPanel testPlanId={testPlanId} open={catalogOpen} onOpenChange={setCatalogOpen} />

      <Dialog open={matrixOpen} onOpenChange={setMatrixOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Traceability matrix</DialogTitle>
            <DialogDescription>
              Filter and manually adjust requirement-to-test-case mappings before finalizing coverage.
            </DialogDescription>
          </DialogHeader>
          <TraceabilityMatrixEditor projectId={projectId} testPlanId={testPlanId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}


function WBFolder({
  icon, label, count, defaultOpen, children,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
        <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {typeof count === "number" && <span className="font-mono text-[10px]">{count}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="pl-3 pr-1 pt-1 pb-2 space-y-0.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function WBSubGroup({
  label, count, className, icon, trailing, defaultOpen, children,
}: {
  label: string;
  count?: number | null;
  className?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="pt-1">
      <CollapsibleTrigger className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-[10px] uppercase tracking-wide hover:bg-muted/40 transition-colors ${className ?? "text-muted-foreground"}`}>
        <ChevronRight className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        {icon}
        <span className="flex-1 text-left truncate">{label}</span>
        {typeof count === "number" && <span className="font-mono text-[10px] opacity-70">{count}</span>}
        {trailing}
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <div className="pl-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
