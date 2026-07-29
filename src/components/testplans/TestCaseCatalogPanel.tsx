import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Search, FlaskConical, Loader2, Info } from "lucide-react";

type Row = {
  id: string;
  title: string;
  description: string | null;
  preconditions: string | null;
  expected_result: string | null;
  priority: number;
  priority_score: number | null;
  test_type: string | null;
  coverage_tags: string[] | null;
  status: string | null;
};

const PRIORITY_LABEL: Record<number, string> = { 1: "P1 — High", 2: "P2 — Medium", 3: "P3 — Low" };

interface Props {
  testPlanId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** Renders the generated test-case catalog (01_test_case_catalog.json) with
 *  filters by test type, priority and coverage tag. */
export function TestCaseCatalogPanel({ testPlanId, open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [priority, setPriority] = useState("all");
  const [tag, setTag] = useState("all");

  const { data: rows = [], isLoading, error } = useQuery<Row[]>({
    queryKey: ["tp-catalog", testPlanId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_plan_test_cases")
        .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, description, preconditions, expected_result, priority, priority_score, test_type, coverage_tags, status)")
        .eq("test_plan_id", testPlanId);
      if (error) throw error;
      return ((data ?? []) as any[]).map(r => r.test_case).filter(Boolean) as Row[];
    },
  });

  const tags = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => (r.coverage_tags ?? []).forEach(t => t && s.add(t)));
    return [...s].sort();
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (type !== "all" && (r.test_type ?? "regression") !== type) return false;
    if (priority !== "all" && String(r.priority) !== priority) return false;
    if (tag !== "all" && !(r.coverage_tags ?? []).includes(tag)) return false;
    if (q && !`${r.title} ${r.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [rows, type, priority, tag, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-emerald-400" /> Generated test-case catalog
          </DialogTitle>
          <DialogDescription>
            {rows.length} case{rows.length === 1 ? "" : "s"} persisted from <span className="font-mono">01_test_case_catalog.json</span>
            {filtered.length !== rows.length ? ` · ${filtered.length} matching filters` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title or description"
              className="h-8 pl-7 text-xs" />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Test type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All test types</SelectItem>
              <SelectItem value="smoke">Smoke</SelectItem>
              <SelectItem value="regression">Regression</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="1">P1 — High</SelectItem>
              <SelectItem value="2">P2 — Medium</SelectItem>
              <SelectItem value="3">P3 — Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Coverage tag" /></SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All coverage tags</SelectItem>
              {tags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {(type !== "all" || priority !== "all" || tag !== "all" || q) && (
            <Button size="sm" variant="ghost" className="h-8 text-xs"
              onClick={() => { setType("all"); setPriority("all"); setTag("all"); setQ(""); }}>
              Clear
            </Button>
          )}
        </div>

        <ScrollArea className="h-[55vh] pr-3">
          {isLoading && (
            <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading catalog…
            </div>
          )}
          {error && (
            <p className="p-4 text-xs text-red-400">Could not load the catalog: {(error as Error).message}</p>
          )}
          {!isLoading && !error && rows.length === 0 && (
            <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/20 p-4 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5" />
              <span>
                No generated test cases yet. Run <strong>1. Generate Test Cases</strong> — once Repo Reader returns
                <span className="font-mono"> 01_test_case_catalog.json</span> the cases appear here automatically.
              </span>
            </div>
          )}
          {!isLoading && rows.length > 0 && filtered.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">No test cases match the current filters.</p>
          )}
          <div className="space-y-1.5">
            {filtered.map(tc => (
              <Collapsible key={tc.id} className="rounded-md border border-border/50 bg-muted/10">
                <CollapsibleTrigger className="group flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                  <span className="flex-1 truncate">{tc.title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {(tc.test_type ?? "regression") === "smoke" ? "Smoke" : "Regression"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{PRIORITY_LABEL[tc.priority] ?? `P${tc.priority}`}</Badge>
                  {typeof tc.priority_score === "number" && (
                    <span className="font-mono text-[10px] text-muted-foreground">{tc.priority_score}</span>
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 border-t border-border/40 px-3 py-2 text-[11px]">
                  {tc.description && <p className="text-muted-foreground whitespace-pre-wrap">{tc.description}</p>}
                  {tc.preconditions && (
                    <p><span className="font-semibold">Preconditions: </span><span className="text-muted-foreground">{tc.preconditions}</span></p>
                  )}
                  {tc.expected_result && (
                    <p><span className="font-semibold">Expected: </span><span className="text-muted-foreground">{tc.expected_result}</span></p>
                  )}
                  {(tc.coverage_tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(tc.coverage_tags ?? []).map(t => (
                        <button key={t} onClick={() => setTag(t)}>
                          <Badge variant="secondary" className="text-[10px]">{t}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
