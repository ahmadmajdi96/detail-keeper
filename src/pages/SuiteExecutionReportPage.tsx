import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useProjectScope } from "@/hooks/useProjectScope";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatFilterCards } from "@/components/ui/stat-filter-cards";
import {
  ChevronRight, Folder, Inbox, Loader2, Download, CheckCircle2, XCircle, Clock, Ban, Search, ExternalLink,
} from "lucide-react";

type Exec = {
  id: string;
  status: string;
  suite_id: string | null;
  test_case_id: string | null;
  test_run_id: string | null;
  test_plan_id: string | null;
  environment: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  test_case?: { title: string | null } | null;
};

const STATUS_STYLE: Record<string, string> = {
  passed: "bg-success/10 text-success border-success/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  blocked: "bg-warning/10 text-warning border-warning/20",
  in_progress: "bg-accent/10 text-accent border-accent/20",
  pending: "bg-muted text-muted-foreground",
  skipped: "bg-muted text-muted-foreground",
};

export default function SuiteExecutionReportPage() {
  const { projectId } = useProjectScope();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [runFilter, setRunFilter] = useState("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const { data: suites = [] } = useQuery({
    queryKey: ["test-suites", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_suites")
        .select("id, name, description")
        .eq("project_id", projectId!)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: executions = [], isLoading } = useQuery<Exec[]>({
    queryKey: ["suite-execution-report", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_executions")
        .select("id, status, suite_id, test_case_id, test_run_id, test_plan_id, environment, started_at, completed_at, created_at, test_case:test_cases(title)")
        .eq("project_id", projectId!)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const runIds = useMemo(
    () => Array.from(new Set(executions.map((e) => e.test_run_id).filter(Boolean))) as string[],
    [executions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return executions.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (runFilter !== "all" && e.test_run_id !== runFilter) return false;
      if (q && !(e.test_case?.title ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [executions, statusFilter, runFilter, search]);

  const groups = useMemo(() => {
    const buckets = suites.map((s: any) => ({
      id: s.id,
      name: s.name as string,
      description: s.description as string | null,
      rows: filtered.filter((e) => e.suite_id === s.id),
    }));
    buckets.push({
      id: "__unassigned__",
      name: "Unassigned",
      description: null,
      rows: filtered.filter((e) => !e.suite_id || !suites.some((s: any) => s.id === e.suite_id)),
    });
    return buckets.filter((b) => b.rows.length > 0 || b.id !== "__unassigned__");
  }, [suites, filtered]);

  const totals = useMemo(() => {
    const by = (s: string) => filtered.filter((e) => e.status === s).length;
    return {
      total: filtered.length,
      passed: by("passed"),
      failed: by("failed"),
      blocked: by("blocked"),
      running: by("in_progress"),
    };
  }, [filtered]);

  const exportCsv = () => {
    const header = ["suite", "suite_id", "test_case", "execution_id", "run_id", "test_plan_id", "status", "environment", "started_at", "completed_at"];
    const lines = groups.flatMap((g) =>
      g.rows.map((r) =>
        [g.name, g.id, r.test_case?.title ?? "", r.id, r.test_run_id ?? "", r.test_plan_id ?? "", r.status, r.environment ?? "", r.started_at ?? "", r.completed_at ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      ),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `suite-execution-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Suite Execution Report"
        description="Execution outcomes grouped by test suite, linked back to their originating suite and run IDs"
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <StatFilterCards
        className="mt-6"
        activeFilter={statusFilter}
        onSelect={setStatusFilter}
        cards={[
          { key: "all", label: "Executions", value: totals.total, hint: `${suites.length} suites`, icon: Folder },
          { key: "passed", label: "Passed", value: totals.passed, hint: totals.total ? `${Math.round(totals.passed / totals.total * 100)}% pass rate` : "—", icon: CheckCircle2, grad: "from-success/20 to-transparent" },
          { key: "failed", label: "Failed", value: totals.failed, hint: "Needs triage", icon: XCircle, grad: "from-destructive/20 to-transparent" },
          { key: "blocked", label: "Blocked", value: totals.blocked, hint: "Impeded", icon: Ban, grad: "from-warning/20 to-transparent" },
          { key: "in_progress", label: "Running", value: totals.running, hint: "In progress", icon: Clock, grad: "from-cyan-500/20 to-transparent" },
        ]}
      />

      <Card className="mt-6 border-border/50">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search test case…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={runFilter} onValueChange={setRunFilter}>
            <SelectTrigger className="w-[260px]"><SelectValue placeholder="All runs" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All runs</SelectItem>
              {runIds.map((r) => (
                <SelectItem key={r} value={r}>Run {r.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {!projectId ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Select a project to see its suite execution report.
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : groups.length === 0 ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">No executions match these filters.</CardContent>
          </Card>
        ) : (
          groups.map((g) => {
            const passed = g.rows.filter((r) => r.status === "passed").length;
            const rate = g.rows.length ? Math.round((passed / g.rows.length) * 100) : 0;
            const isOpen = open[g.id] ?? true;
            return (
              <Card key={g.id} className="border-border/50 overflow-hidden">
                <Collapsible open={isOpen} onOpenChange={() => setOpen((p) => ({ ...p, [g.id]: !isOpen }))}>
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-3">
                      <CollapsibleTrigger asChild>
                        <button className="flex flex-1 items-center gap-2 text-left">
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
                          {g.id === "__unassigned__" ? <Inbox className="h-4 w-4 text-muted-foreground" /> : <Folder className="h-4 w-4 text-accent" />}
                          <CardTitle className="text-base">{g.name}</CardTitle>
                          <Badge variant="outline">{g.rows.length}</Badge>
                          {g.id !== "__unassigned__" && (
                            <code className="hidden md:inline text-[10px] text-muted-foreground">suite {g.id.slice(0, 8)}</code>
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <div className="w-40 hidden sm:block">
                        <Progress value={rate} className="h-2" />
                        <p className="text-[11px] text-muted-foreground mt-1 text-right">{rate}% passed</p>
                      </div>
                      {g.id !== "__unassigned__" && (
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/test-cases?suite=${g.id}`}>
                            Open suite <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                    </div>
                    {g.description && <CardDescription className="pl-10">{g.description}</CardDescription>}
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent className="p-0 border-t border-border/50">
                      <ul className="divide-y divide-border/40">
                        {g.rows.map((r) => (
                          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                            <span className="flex-1 min-w-[180px] truncate text-sm font-medium">
                              {r.test_case?.title ?? "Untitled test case"}
                            </span>
                            <code className="text-[10px] text-muted-foreground">exec {r.id.slice(0, 8)}</code>
                            {r.test_run_id ? (
                              <Link to={`/executions?run=${r.test_run_id}`} className="text-[10px] text-accent hover:underline">
                                run {r.test_run_id.slice(0, 8)}
                              </Link>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">no run id</span>
                            )}
                            {r.test_plan_id && (
                              <Link to={`/test-plans/${r.test_plan_id}`} className="text-[10px] text-accent hover:underline">
                                plan {r.test_plan_id.slice(0, 8)}
                              </Link>
                            )}
                            {r.environment && <Badge variant="outline" className="text-[10px]">{r.environment}</Badge>}
                            <span className="text-[11px] text-muted-foreground">
                              {r.completed_at
                                ? new Date(r.completed_at).toLocaleString()
                                : r.started_at
                                  ? new Date(r.started_at).toLocaleString()
                                  : new Date(r.created_at).toLocaleString()}
                            </span>
                            <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[r.status] ?? ""}`}>{r.status}</Badge>
                          </li>
                        ))}
                        {g.rows.length === 0 && (
                          <li className="px-4 py-6 text-center text-sm text-muted-foreground">No executions recorded for this suite.</li>
                        )}
                      </ul>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>
    </AppLayout>
  );
}
