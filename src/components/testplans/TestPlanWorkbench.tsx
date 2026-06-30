import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, FileCode2, Play, Save, Sparkles, Wand2, Loader2, X, CheckCircle2, XCircle, Clock } from "lucide-react";
import { SpecRunPanel } from "./SpecRunPanel";

type Doc = { id: string; slug: string; title: string; kind: string; content: string; sort_order: number };
type Spec = { id: string; filename: string; content: string; document_id: string | null };
type OpenFile =
  | { kind: "doc"; id: string; label: string }
  | { kind: "spec"; id: string; label: string };

interface Props { testPlanId: string; projectId: string }

export function TestPlanWorkbench({ testPlanId, projectId }: Props) {
  const qc = useQueryClient();
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

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

  // Realtime: invalidate when docs/specs change for this plan.
  useEffect(() => {
    const ch = supabase
      .channel(`tp-wb-${testPlanId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "test_plan_documents_v2", filter: `test_plan_id=eq.${testPlanId}` },
        () => qc.invalidateQueries({ queryKey: ["tp-docs", testPlanId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "test_plan_specs", filter: `test_plan_id=eq.${testPlanId}` },
        () => qc.invalidateQueries({ queryKey: ["tp-specs", testPlanId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [testPlanId, qc]);

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

  const runGenerateDocs = async () => {
    setGeneratingDocs(true);
    try {
      const { data, error } = await supabase.functions.invoke("tp-generate-docs", { body: { test_plan_id: testPlanId } });
      if (error) throw error;
      toast.success(`Generated ${data?.documents?.length ?? 0} documents`);
      qc.invalidateQueries({ queryKey: ["tp-docs", testPlanId] });
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally { setGeneratingDocs(false); }
  };

  const runGenerateCode = async () => {
    setGeneratingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke("tp-generate-cases-and-code", { body: { test_plan_id: testPlanId } });
      if (error) throw error;
      toast.success(`Generated ${data?.specs ?? 0} specs and ${data?.cases ?? 0} test cases`);
      qc.invalidateQueries({ queryKey: ["tp-specs", testPlanId] });
      qc.invalidateQueries({ queryKey: ["test-plan-cases", testPlanId] });
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally { setGeneratingCode(false); }
  };

  const runSpec = async () => {
    if (!currentFile || currentFile.kind !== "spec") return;
    try {
      const { data, error } = await supabase.functions.invoke("spec-run-dispatch", { body: { spec_id: currentFile.id } });
      if (error) throw error;
      toast.success("Spec dispatched");
      return data?.spec_run_id as string;
    } catch (e: any) {
      toast.error(e.message || "Run failed");
    }
  };

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 bg-muted/30">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-accent" /> Test Plan Workbench
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={runGenerateDocs} disabled={generatingDocs}>
            {generatingDocs ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
            1. Generate 10 Documents
          </Button>
          <Button size="sm" variant="outline" onClick={runGenerateCode} disabled={generatingCode || docs.length === 0}>
            {generatingCode ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            2. Generate Cases &amp; Code
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 min-h-[600px]">
        {/* File tree */}
        <aside className="col-span-3 border-r border-border/50 bg-muted/10">
          <ScrollArea className="h-[600px]">
            <div className="p-3 space-y-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Documents ({docs.length})
                </div>
                {docs.length === 0 && <p className="text-xs text-muted-foreground">No documents yet — click <em>Generate 10 Documents</em>.</p>}
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
                  <FileCode2 className="h-3 w-3" /> Specs ({specs.length})
                </div>
                {specs.length === 0 && <p className="text-xs text-muted-foreground">No specs yet — generate documents then code.</p>}
                <div className="space-y-0.5">
                  {specs.map(s => (
                    <button key={s.id}
                      onClick={() => openFile({ kind: "spec", id: s.id, label: s.filename })}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/50 truncate">
                      <span className="text-accent">🧪</span> {s.filename}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </aside>

        {/* Editor */}
        <section className="col-span-9 flex flex-col">
          {/* Tab bar */}
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

          {/* Monaco */}
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

          {/* Run output for active spec */}
          {currentFile?.kind === "spec" && (
            <SpecRunPanel specId={currentFile.id} />
          )}
        </section>
      </div>
    </div>
  );
}
