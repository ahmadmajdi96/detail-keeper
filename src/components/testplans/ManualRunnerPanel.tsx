import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  ClipboardList, Play, CheckCircle2, XCircle, Ban, SkipForward, CircleDashed,
  Upload, Bug, Loader2, ChevronLeft, ChevronRight, Flag, Paperclip, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "pending" | "passed" | "failed" | "blocked" | "skipped" | "in_progress";

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  pending: { label: "Not Executed", icon: CircleDashed, cls: "text-muted-foreground border-border" },
  in_progress: { label: "In Progress", icon: Loader2, cls: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10" },
  passed: { label: "Pass", icon: CheckCircle2, cls: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  failed: { label: "Fail", icon: XCircle, cls: "text-rose-400 border-rose-500/40 bg-rose-500/10" },
  blocked: { label: "Blocked", icon: Ban, cls: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
  skipped: { label: "Skipped", icon: SkipForward, cls: "text-slate-400 border-slate-500/40 bg-slate-500/10" },
};

interface Props {
  testPlanId: string;
  projectId: string;
  workspaceId?: string | null;
}

export function ManualRunnerPanel({ testPlanId, projectId, workspaceId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const { data: suites = [] } = useQuery<any[]>({
    queryKey: ["mr-suites", testPlanId],
    queryFn: async () => {
      const { data } = await supabase.from("test_suites").select("id, name").eq("project_id", projectId).order("name");
      return data ?? [];
    },
    enabled: !!projectId,
  });

  const { data: planCases = [] } = useQuery<any[]>({
    queryKey: ["mr-cases", testPlanId],
    queryFn: async () => {
      const { data } = await supabase
        .from("test_plan_test_cases")
        .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, priority, test_type, suite_id, preconditions, description)")
        .eq("test_plan_id", testPlanId);
      return (data ?? []).map((r: any) => r.test_case).filter(Boolean);
    },
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["manual-sessions", testPlanId],
    queryFn: async () => {
      const { data } = await supabase
        .from("manual_execution_sessions" as any)
        .select("*").eq("test_plan_id", testPlanId).order("started_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const activeSession = sessions.find((s) => s.id === sessionId) ?? null;

  const { data: items = [] } = useQuery<any[]>({
    queryKey: ["manual-items", sessionId],
    queryFn: async () => {
      const { data } = await supabase
        .from("manual_execution_items" as any)
        .select("*, test_case:test_cases(id, title, priority, test_type, description, preconditions)")
        .eq("session_id", sessionId!)
        .order("sort_order");
      return (data ?? []) as any[];
    },
    enabled: !!sessionId,
  });

  const current = items[idx] ?? null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { passed: 0, failed: 0, blocked: 0, skipped: 0, pending: 0 };
    items.forEach((i) => { c[i.status] = (c[i.status] ?? 0) + 1; });
    return c;
  }, [items]);
  const done = counts.passed + counts.failed + counts.blocked + counts.skipped;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ClipboardList className="h-4 w-4 text-cyan-400" /> Manual Execution
        </div>
        <div className="flex-1" />
        <Select value={sessionId ?? ""} onValueChange={(v) => { setSessionId(v); setIdx(0); }}>
          <SelectTrigger className="h-8 w-[260px] text-xs">
            <SelectValue placeholder={sessions.length ? "Open a session…" : "No sessions yet"} />
          </SelectTrigger>
          <SelectContent>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} · {s.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setSetupOpen(true)}>
          <Play className="h-3.5 w-3.5 mr-1" /> New Manual Session
        </Button>
      </div>

      {!activeSession && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Start a manual session to execute test cases step by step, capture evidence and raise defects.
          </CardContent>
        </Card>
      )}

      {activeSession && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <div>
                  <CardTitle className="text-base">{activeSession.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {activeSession.environment ?? "—"} · {activeSession.browser ?? "—"}
                    {activeSession.build_version ? ` · build ${activeSession.build_version}` : ""}
                  </CardDescription>
                </div>
                <div className="flex-1" />
                {Object.entries(counts).map(([k, v]) => (
                  <Badge key={k} variant="outline" className={cn("text-[10px]", STATUS_META[k]?.cls)}>
                    {STATUS_META[k]?.label}: {v}
                  </Badge>
                ))}
                {activeSession.status !== "completed" && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    await supabase.from("manual_execution_sessions" as any).update({
                      status: "completed",
                      finished_at: new Date().toISOString(),
                      summary: { ...counts, total: items.length },
                    }).eq("id", activeSession.id);
                    toast.success("Session closed");
                    qc.invalidateQueries({ queryKey: ["manual-sessions", testPlanId] });
                  }}>
                    <Flag className="h-3.5 w-3.5 mr-1" /> End session
                  </Button>
                )}
              </div>
              <Progress value={pct} className="h-1.5 mt-2" />
            </CardHeader>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <Card className="overflow-hidden">
              <ScrollArea className="h-[520px]">
                <div className="p-2 space-y-1">
                  {items.map((it, i) => {
                    const M = STATUS_META[it.status] ?? STATUS_META.pending;
                    return (
                      <button key={it.id} onClick={() => setIdx(i)}
                        className={cn("w-full rounded-md border p-2 text-left transition-colors",
                          i === idx ? "border-cyan-500/60 bg-cyan-500/10" : "border-border/40 hover:bg-muted/50")}>
                        <div className="flex items-center gap-2">
                          <M.icon className={cn("h-3.5 w-3.5 shrink-0", M.cls.split(" ")[0])} />
                          <span className="flex-1 truncate text-xs">{it.test_case?.title ?? "Untitled"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>

            {current ? (
              <ManualCaseRunner
                key={current.id}
                item={current}
                projectId={projectId}
                workspaceId={workspaceId}
                userId={user?.id}
                onSaved={() => {
                  qc.invalidateQueries({ queryKey: ["manual-items", sessionId] });
                  if (idx < items.length - 1) setIdx(idx + 1);
                }}
                onPrev={() => setIdx(Math.max(0, idx - 1))}
                onNext={() => setIdx(Math.min(items.length - 1, idx + 1))}
                position={`${idx + 1} / ${items.length}`}
              />
            ) : (
              <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No test cases in this session.</CardContent></Card>
            )}
          </div>
        </>
      )}

      <SessionSetupDialog
        open={setupOpen} onOpenChange={setSetupOpen}
        testPlanId={testPlanId} projectId={projectId} workspaceId={workspaceId}
        suites={suites} cases={planCases}
        onCreated={(id) => { setSessionId(id); setIdx(0); qc.invalidateQueries({ queryKey: ["manual-sessions", testPlanId] }); }}
      />
    </div>
  );
}

/* ---------------- session setup ---------------- */

function SessionSetupDialog({
  open, onOpenChange, testPlanId, projectId, workspaceId, suites, cases, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  testPlanId: string; projectId: string; workspaceId?: string | null;
  suites: any[]; cases: any[]; onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("staging");
  const [browser, setBrowser] = useState("chrome");
  const [device, setDevice] = useState("desktop");
  const [build, setBuild] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [scopeKind, setScopeKind] = useState<"plan" | "suite" | "cases">("plan");
  const [suiteIds, setSuiteIds] = useState<string[]>([]);
  const [caseIds, setCaseIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => {
    if (scopeKind === "plan") return cases;
    if (scopeKind === "suite") return cases.filter((c) => suiteIds.includes(c.suite_id));
    return cases.filter((c) => caseIds.includes(c.id));
  }, [scopeKind, suiteIds, caseIds, cases]);

  const create = async () => {
    if (selected.length === 0) { toast.error("Select at least one test case"); return; }
    setSaving(true);
    try {
      const { data: session, error } = await supabase.from("manual_execution_sessions" as any).insert({
        test_plan_id: testPlanId, project_id: projectId, workspace_id: workspaceId ?? null,
        name: name.trim() || `Manual run · ${new Date().toLocaleString()}`,
        environment, browser, device, build_version: build.trim() || null,
        base_url: baseUrl.trim() || null, tester_id: user?.id ?? null, created_by: user?.id ?? null,
        status: "in_progress",
        scope: { kind: scopeKind, suite_ids: suiteIds, case_ids: selected.map((c) => c.id) },
      } as any).select("id").single();
      if (error) throw error;

      const rows = selected.map((c, i) => ({
        session_id: (session as any).id, project_id: projectId, test_case_id: c.id,
        suite_id: c.suite_id ?? null, sort_order: i, status: "pending",
      }));
      const { error: iErr } = await supabase.from("manual_execution_items" as any).insert(rows as any);
      if (iErr) throw iErr;

      toast.success(`Session started with ${rows.length} test case${rows.length === 1 ? "" : "s"}`);
      onCreated((session as any).id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Could not start session");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New manual execution session</DialogTitle>
          <DialogDescription>Choose the scope and run conditions for this session.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Session name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Regression sweep — sprint 14" className="h-8" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Environment</Label>
              <Select value={environment} onValueChange={setEnvironment}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["dev", "qa", "staging", "uat", "production"].map((e) => <SelectItem key={e} value={e}>{e.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Browser</Label>
              <Select value={browser} onValueChange={setBrowser}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["chrome", "firefox", "safari", "edge"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Device</Label>
              <Select value={device} onValueChange={setDevice}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["desktop", "tablet", "mobile"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Build version</Label>
              <Input value={build} onChange={(e) => setBuild(e.target.value)} placeholder="1.4.0" className="h-8" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Application URL</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://staging.myapp.com" className="h-8 font-mono text-xs" />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs">Scope</Label>
            <Select value={scopeKind} onValueChange={(v) => setScopeKind(v as any)}>
              <SelectTrigger className="h-8 text-xs w-[280px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="plan">Entire test plan ({cases.length})</SelectItem>
                <SelectItem value="suite">Selected suites</SelectItem>
                <SelectItem value="cases">Selected test cases</SelectItem>
              </SelectContent>
            </Select>

            {scopeKind === "suite" && (
              <ScrollArea className="h-[180px] rounded-md border p-2">
                {suites.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 py-1 text-xs">
                    <Checkbox checked={suiteIds.includes(s.id)}
                      onCheckedChange={(c) => setSuiteIds((prev) => c ? [...prev, s.id] : prev.filter((x) => x !== s.id))} />
                    {s.name} <span className="text-muted-foreground">({cases.filter((c) => c.suite_id === s.id).length})</span>
                  </label>
                ))}
              </ScrollArea>
            )}
            {scopeKind === "cases" && (
              <ScrollArea className="h-[180px] rounded-md border p-2">
                {cases.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-1 text-xs">
                    <Checkbox checked={caseIds.includes(c.id)}
                      onCheckedChange={(v) => setCaseIds((prev) => v ? [...prev, c.id] : prev.filter((x) => x !== c.id))} />
                    <span className="truncate">{c.title}</span>
                  </label>
                ))}
              </ScrollArea>
            )}
            <p className="text-xs text-muted-foreground">{selected.length} test case{selected.length === 1 ? "" : "s"} selected.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create} disabled={saving || selected.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Start session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- single case runner ---------------- */

function ManualCaseRunner({
  item, projectId, workspaceId, userId, onSaved, onPrev, onNext, position,
}: {
  item: any; projectId: string; workspaceId?: string | null; userId?: string;
  onSaved: () => void; onPrev: () => void; onNext: () => void; position: string;
}) {
  const qc = useQueryClient();
  const startedAt = useRef(Date.now());
  const [status, setStatus] = useState<Status>(item.status);
  const [actual, setActual] = useState<string>(item.actual_result ?? "");
  const [notes, setNotes] = useState<string>(item.notes ?? "");
  const [stepResults, setStepResults] = useState<Record<string, string>>(
    (item.step_results && typeof item.step_results === "object" && !Array.isArray(item.step_results))
      ? item.step_results : {},
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { startedAt.current = Date.now(); }, [item.id]);

  const { data: steps = [] } = useQuery<any[]>({
    queryKey: ["mr-steps", item.test_case_id],
    queryFn: async () => {
      const { data } = await supabase.from("test_case_steps").select("*")
        .eq("test_case_id", item.test_case_id).order("step_number");
      return data ?? [];
    },
  });

  const { data: evidence = [] } = useQuery<any[]>({
    queryKey: ["mr-evidence", item.id],
    queryFn: async () => {
      const { data } = await supabase.from("evidence").select("*")
        .eq("step_result_id", item.id).order("captured_at", { ascending: false });
      return data ?? [];
    },
  });

  const save = async (nextStatus: Status) => {
    setSaving(true);
    try {
      const { error } = await supabase.from("manual_execution_items" as any).update({
        status: nextStatus,
        actual_result: actual || null,
        notes: notes || null,
        step_results: stepResults,
        executed_at: new Date().toISOString(),
        executed_by: userId ?? null,
        duration_seconds: Math.round((Date.now() - startedAt.current) / 1000),
      }).eq("id", item.id);
      if (error) throw error;
      setStatus(nextStatus);
      toast.success(`Marked ${STATUS_META[nextStatus].label}`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally { setSaving(false); }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    try {
      for (const file of list) {
        const path = `${projectId}/manual/${item.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from("defect-evidence").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("defect-evidence").getPublicUrl(path);
        const { error: evErr } = await supabase.from("evidence").insert({
          step_result_id: item.id, project_id: projectId, workspace_id: workspaceId ?? null,
          file_name: file.name, file_type: file.type || "application/octet-stream",
          file_url: pub.publicUrl, storage_path: path, size_bytes: file.size, uploaded_by: userId ?? null,
        } as any);
        if (evErr) throw evErr;
      }
      toast.success(`${list.length} file${list.length === 1 ? "" : "s"} attached`);
      qc.invalidateQueries({ queryKey: ["mr-evidence", item.id] });
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setUploading(false); }
  };

  const tc = item.test_case ?? {};
  const M = STATUS_META[status] ?? STATUS_META.pending;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px]">{position}</Badge>
          <CardTitle className="text-base flex-1 min-w-0 truncate">{tc.title}</CardTitle>
          {tc.priority && <Badge variant="secondary" className="text-[10px]">{tc.priority}</Badge>}
          {tc.test_type && <Badge variant="outline" className="text-[10px]">{tc.test_type}</Badge>}
          <Badge variant="outline" className={cn("text-[10px]", M.cls)}>{M.label}</Badge>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {tc.preconditions && (
          <div className="rounded-md border border-border/50 bg-muted/20 p-2.5">
            <div className="text-[11px] font-semibold text-muted-foreground mb-1">Preconditions</div>
            <p className="whitespace-pre-wrap text-xs">{tc.preconditions}</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-muted-foreground">Steps</div>
          {steps.length === 0 && <p className="text-xs text-muted-foreground">{tc.description || "No steps recorded for this test case."}</p>}
          {steps.map((s) => (
            <div key={s.id} className="rounded-md border border-border/50 p-2.5 space-y-1.5">
              <div className="flex gap-2 text-xs">
                <span className="font-mono text-muted-foreground">{s.step_number}.</span>
                <span className="flex-1 whitespace-pre-wrap">{s.action}</span>
              </div>
              {s.expected_result && (
                <p className="pl-6 text-[11px] text-muted-foreground"><span className="font-medium">Expected:</span> {s.expected_result}</p>
              )}
              <div className="pl-6 flex gap-1">
                {(["passed", "failed", "blocked", "skipped"] as const).map((st) => (
                  <Button key={st} size="sm" variant={stepResults[s.id] === st ? "default" : "outline"}
                    className="h-6 text-[10px] px-2"
                    onClick={() => setStepResults((p) => ({ ...p, [s.id]: st }))}>
                    {STATUS_META[st].label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Actual result</Label>
            <Textarea rows={3} value={actual} onChange={(e) => setActual(e.target.value)} placeholder="What actually happened…" className="text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Execution notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations, data used, anomalies…" className="text-xs" />
          </div>
        </div>

        {/* Evidence */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1"><Paperclip className="h-3 w-3" /> Evidence</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className={cn("cursor-pointer rounded-md border border-dashed p-4 text-center text-xs transition-colors",
              dragging ? "border-cyan-500 bg-cyan-500/10" : "border-border/60 hover:bg-muted/30")}
          >
            {uploading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : <Upload className="mx-auto h-5 w-5 text-muted-foreground" />}
            <p className="mt-1 text-muted-foreground">Drag & drop screenshots, video, PDF or logs — or click to browse</p>
          </div>
          <input ref={fileRef} type="file" multiple hidden
            onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.currentTarget.value = ""; }} />
          {evidence.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {evidence.map((ev) => (
                <div key={ev.id} className="group relative overflow-hidden rounded-md border border-border/50">
                  {String(ev.file_type).startsWith("image/") ? (
                    <img src={ev.file_url} alt={ev.file_name} className="h-20 w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-20 items-center justify-center bg-muted/30 px-2 text-[10px]">{ev.file_name}</div>
                  )}
                  <button
                    className="absolute right-1 top-1 hidden rounded bg-background/80 p-1 group-hover:block"
                    onClick={async () => {
                      if (ev.storage_path) await supabase.storage.from("defect-evidence").remove([ev.storage_path]);
                      await supabase.from("evidence").delete().eq("id", ev.id);
                      qc.invalidateQueries({ queryKey: ["mr-evidence", item.id] });
                    }}>
                    <Trash2 className="h-3 w-3 text-rose-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={saving} onClick={() => save("passed")} className="bg-emerald-600 hover:bg-emerald-600/90">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Pass
          </Button>
          <Button size="sm" disabled={saving} variant="destructive" onClick={() => save("failed")}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Fail
          </Button>
          <Button size="sm" disabled={saving} variant="outline" onClick={() => save("blocked")}>
            <Ban className="h-3.5 w-3.5 mr-1" /> Blocked
          </Button>
          <Button size="sm" disabled={saving} variant="outline" onClick={() => save("skipped")}>
            <SkipForward className="h-3.5 w-3.5 mr-1" /> Skip
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setBugOpen(true)}>
            <Bug className="h-3.5 w-3.5 mr-1" /> Create Bug
          </Button>
        </div>
      </CardContent>

      <CreateBugDialog
        open={bugOpen} onOpenChange={setBugOpen}
        item={item} steps={steps} actual={actual} projectId={projectId}
        workspaceId={workspaceId} userId={userId}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["mr-evidence", item.id] }); onSaved(); }}
      />
    </Card>
  );
}

/* ---------------- create bug ---------------- */

function CreateBugDialog({
  open, onOpenChange, item, steps, actual, projectId, workspaceId, userId, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  item: any; steps: any[]; actual: string; projectId: string;
  workspaceId?: string | null; userId?: string; onCreated: () => void;
}) {
  const tc = item.test_case ?? {};
  const [title, setTitle] = useState(`[${tc.title ?? "Test case"}] failed during manual execution`);
  const [severity, setSeverity] = useState("major");
  const [priority, setPriority] = useState("high");
  const [saving, setSaving] = useState(false);

  const description = useMemo(() => [
    `**Test case:** ${tc.title ?? item.test_case_id}`,
    "",
    "**Steps to reproduce:**",
    ...(steps.length
      ? steps.map((s) => `${s.step_number}. ${s.action}`)
      : ["1. See linked test case."]),
    "",
    `**Expected:** ${steps.map((s) => s.expected_result).filter(Boolean).join(" / ") || "See test case"}`,
    `**Actual:** ${actual || "Not recorded"}`,
  ].join("\n"), [steps, actual, tc, item]);

  const create = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.from("defects").insert({
        project_id: projectId, workspace_id: workspaceId ?? null,
        title: title.trim(), description,
        severity: severity as any, priority: priority as any,
        status: "open", reporter_id: userId ?? null, test_case_id: item.test_case_id,
      } as any).select("id").single();
      if (error) throw error;
      await supabase.from("manual_execution_items" as any).update({ defect_id: (data as any).id, status: "failed" }).eq("id", item.id);
      await supabase.from("evidence").update({ defect_id: (data as any).id }).eq("step_result_id", item.id);
      toast.success("Defect created and linked");
      onCreated();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Could not create defect");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create bug from failing test case</DialogTitle>
          <DialogDescription>Pre-filled from the test case, its steps and your actual result.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["critical", "major", "minor", "trivial"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["urgent", "high", "medium", "low"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea rows={8} readOnly value={description} className="font-mono text-[11px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={create} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bug className="h-4 w-4 mr-1" />} Create defect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
