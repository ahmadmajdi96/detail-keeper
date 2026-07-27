import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import {
  Loader2, Search, Link2, Link2Off, AlertTriangle, CheckCircle2, Download, Grid3x3,
} from "lucide-react";

type Req = { id: string; key: string | null; title: string; status: string | null; priority: number | null };
type TCase = { id: string; title: string; test_type: string | null; priority: number | null; suite_id: string | null };
type Link = { id: string; requirement_id: string; linked_id: string };

interface Props {
  projectId: string | null;
  testPlanId: string;
}

/**
 * Requirement ⇄ test-case traceability matrix. Coverage is computed live and
 * every mapping can be toggled by hand before the coverage is finalized.
 */
export function TraceabilityMatrixEditor({ projectId, testPlanId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [reqQuery, setReqQuery] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [coverage, setCoverage] = useState<"all" | "covered" | "uncovered">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeReq, setActiveReq] = useState<string | null>(null);

  const { data: requirements = [], isLoading: reqLoading } = useQuery<Req[]>({
    queryKey: ["tm-requirements", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirements")
        .select("id, key, title, status, priority")
        .eq("project_id", projectId!)
        .order("key");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const { data: cases = [] } = useQuery<TCase[]>({
    queryKey: ["tm-cases", testPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_plan_test_cases")
        .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, test_type, priority, suite_id)")
        .eq("test_plan_id", testPlanId);
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => r.test_case).filter(Boolean);
    },
  });

  const { data: links = [] } = useQuery<Link[]>({
    queryKey: ["tm-links", projectId],
    enabled: requirements.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requirement_links")
        .select("id, requirement_id, linked_id")
        .eq("linked_type", "test_case")
        .in("requirement_id", requirements.map((r) => r.id));
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const linkKey = (reqId: string, caseId: string) => `${reqId}|${caseId}`;
  const linkMap = useMemo(() => {
    const m = new Map<string, Link>();
    links.forEach((l) => m.set(linkKey(l.requirement_id, l.linked_id), l));
    return m;
  }, [links]);

  const coveredCount = (reqId: string) => links.filter((l) => l.requirement_id === reqId).length;

  const toggle = useMutation({
    mutationFn: async ({ reqId, caseId }: { reqId: string; caseId: string }) => {
      const existing = linkMap.get(linkKey(reqId, caseId));
      if (existing) {
        const { error } = await supabase.from("requirement_links").delete().eq("id", existing.id);
        if (error) throw error;
        return "unlinked";
      }
      const { error } = await supabase.from("requirement_links").insert({
        requirement_id: reqId,
        linked_type: "test_case",
        linked_id: caseId,
        created_by: user?.id ?? null,
      } as any);
      if (error) throw error;
      return "linked";
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["tm-links", projectId] });
      qc.invalidateQueries({ queryKey: ["coverage-summary"] });
      toast.success(r === "linked" ? "Mapping added" : "Mapping removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkLink = useMutation({
    mutationFn: async ({ reqId, caseIds, link }: { reqId: string; caseIds: string[]; link: boolean }) => {
      if (link) {
        const rows = caseIds
          .filter((cid) => !linkMap.has(linkKey(reqId, cid)))
          .map((cid) => ({ requirement_id: reqId, linked_type: "test_case", linked_id: cid, created_by: user?.id ?? null }));
        if (!rows.length) return 0;
        const { error } = await supabase.from("requirement_links").insert(rows as any);
        if (error) throw error;
        return rows.length;
      }
      const ids = caseIds.map((cid) => linkMap.get(linkKey(reqId, cid))?.id).filter(Boolean) as string[];
      if (!ids.length) return 0;
      const { error } = await supabase.from("requirement_links").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["tm-links", projectId] });
      toast.success(`${n} mapping${n === 1 ? "" : "s"} updated`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredReqs = useMemo(() => {
    const q = reqQuery.trim().toLowerCase();
    return requirements.filter((r) => {
      if (q && !(`${r.key ?? ""} ${r.title}`.toLowerCase().includes(q))) return false;
      const n = coveredCount(r.id);
      if (coverage === "covered" && n === 0) return false;
      if (coverage === "uncovered" && n > 0) return false;
      return true;
    });
  }, [requirements, reqQuery, coverage, links]);

  const filteredCases = useMemo(() => {
    const q = caseQuery.trim().toLowerCase();
    return cases.filter((c) => {
      if (q && !c.title.toLowerCase().includes(q)) return false;
      if (typeFilter !== "all" && (c.test_type ?? "regression") !== typeFilter) return false;
      return true;
    });
  }, [cases, caseQuery, typeFilter]);

  const totalCovered = requirements.filter((r) => coveredCount(r.id) > 0).length;
  const pct = requirements.length ? Math.round((totalCovered / requirements.length) * 100) : 0;

  const exportCsv = () => {
    const header = ["requirement_key", "requirement", "test_case", "test_type", "mapped"];
    const rows = filteredReqs.flatMap((r) =>
      filteredCases.map((c) =>
        [r.key ?? "", r.title, c.title, c.test_type ?? "regression", linkMap.has(linkKey(r.id, c.id)) ? "yes" : "no"]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      ),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "traceability-matrix.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const selectedReq = filteredReqs.find((r) => r.id === activeReq) ?? filteredReqs[0] ?? null;

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Grid3x3 className="h-4 w-4 text-accent" /> Traceability matrix
            </div>
            <Badge variant="outline">{requirements.length} requirements</Badge>
            <Badge variant="outline">{cases.length} test cases</Badge>
            <Badge variant="outline">{links.length} mappings</Badge>
            <div className="ml-auto flex items-center gap-3">
              <div className="w-40">
                <Progress value={pct} className="h-2" />
              </div>
              <span className="text-xs text-muted-foreground">{pct}% requirements covered</span>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-8" placeholder="Filter requirements…" value={reqQuery} onChange={(e) => setReqQuery(e.target.value)} />
            </div>
            <Select value={coverage} onValueChange={(v: any) => setCoverage(v)}>
              <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All requirements</SelectItem>
                <SelectItem value="covered">Covered only</SelectItem>
                <SelectItem value="uncovered">Uncovered only</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-8 pl-8" placeholder="Filter test cases…" value={caseQuery} onChange={(e) => setCaseQuery(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="smoke">Smoke</SelectItem>
                <SelectItem value="regression">Regression</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {reqLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : requirements.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No requirements in this project yet — generate or import requirements to build a matrix.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-5 border-border/50">
            <CardContent className="p-0">
              <ScrollArea className="h-[460px]">
                <ul className="divide-y divide-border/40">
                  {filteredReqs.map((r) => {
                    const n = coveredCount(r.id);
                    const active = selectedReq?.id === r.id;
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => setActiveReq(r.id)}
                          className={`w-full px-3 py-2.5 text-left transition-colors ${active ? "bg-accent/10 border-l-2 border-accent" : "hover:bg-muted/40 border-l-2 border-transparent"}`}
                        >
                          <div className="flex items-center gap-2">
                            {n > 0
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                              : <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                            <span className="font-mono text-[10px] text-muted-foreground">{r.key ?? "REQ"}</span>
                            <span className="truncate text-sm">{r.title}</span>
                            <Badge variant="outline" className="ml-auto text-[10px]">{n}</Badge>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {filteredReqs.length === 0 && (
                    <li className="px-4 py-8 text-center text-sm text-muted-foreground">No requirements match these filters.</li>
                  )}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-7 border-border/50">
            <CardContent className="p-0">
              {!selectedReq ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Select a requirement to edit its mappings.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-3 py-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{selectedReq.key ?? "REQ"}</span>
                    <span className="truncate text-sm font-medium">{selectedReq.title}</span>
                    <div className="ml-auto flex gap-1.5">
                      <Button size="sm" variant="outline"
                        onClick={() => bulkLink.mutate({ reqId: selectedReq.id, caseIds: filteredCases.map((c) => c.id), link: true })}
                        disabled={bulkLink.isPending}>
                        <Link2 className="mr-1.5 h-3.5 w-3.5" /> Link all shown
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => bulkLink.mutate({ reqId: selectedReq.id, caseIds: filteredCases.map((c) => c.id), link: false })}
                        disabled={bulkLink.isPending}>
                        <Link2Off className="mr-1.5 h-3.5 w-3.5" /> Clear shown
                      </Button>
                    </div>
                  </div>
                  <ScrollArea className="h-[410px]">
                    <ul className="divide-y divide-border/40">
                      {filteredCases.map((c) => {
                        const mapped = linkMap.has(linkKey(selectedReq.id, c.id));
                        return (
                          <li key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
                            <Checkbox
                              checked={mapped}
                              disabled={toggle.isPending}
                              onCheckedChange={() => toggle.mutate({ reqId: selectedReq.id, caseId: c.id })}
                            />
                            <span className="flex-1 truncate text-sm">{c.title}</span>
                            <Badge variant="outline" className="text-[10px]">{c.test_type ?? "regression"}</Badge>
                            <Badge variant="outline" className="text-[10px]">P{c.priority ?? "-"}</Badge>
                          </li>
                        );
                      })}
                      {filteredCases.length === 0 && (
                        <li className="px-4 py-8 text-center text-sm text-muted-foreground">No test cases match these filters.</li>
                      )}
                    </ul>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
