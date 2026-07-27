import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, FileCode2, FileText, FlaskConical, FolderTree, GitBranch, Loader2 } from "lucide-react";

interface Props {
  testPlanId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type Row = { id: string; label: string; provenance: any };

/**
 * Shows, for each generated artifact, exactly which document versions and
 * traceability mappings were live when it was produced.
 */
export function ProvenancePanel({ testPlanId, open, onOpenChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tp-provenance", testPlanId],
    enabled: open,
    queryFn: async () => {
      const { data: caseRows } = await supabase
        .from("test_plan_test_cases")
        .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, suite_id, provenance)")
        .eq("test_plan_id", testPlanId);
      const cases = ((caseRows ?? []) as any[]).map((r) => r.test_case).filter(Boolean);

      const suiteIds = Array.from(new Set(cases.map((c: any) => c.suite_id).filter(Boolean)));
      let suites: any[] = [];
      if (suiteIds.length) {
        const { data: s } = await supabase
          .from("test_suites").select("id, name, provenance").in("id", suiteIds as string[]);
        suites = s ?? [];
      }

      const { data: specs } = await supabase
        .from("test_plan_specs" as any)
        .select("id, filename, provenance")
        .eq("test_plan_id", testPlanId).order("filename");

      return {
        suites: suites.map((s: any) => ({ id: s.id, label: s.name, provenance: s.provenance })) as Row[],
        cases: cases.map((c: any) => ({ id: c.id, label: c.title, provenance: c.provenance })) as Row[],
        specs: ((specs ?? []) as any[]).map((s) => ({ id: s.id, label: s.filename, provenance: s.provenance })) as Row[],
      };
    },
  });

  const renderList = (rows: Row[], icon: JSX.Element) => (
    <ScrollArea className="h-[48vh] rounded-md border border-border/50">
      <div className="divide-y divide-border/40">
        {!rows.length && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing generated yet.</p>
        )}
        {rows.map((r) => {
          const p = r.provenance;
          const isOpen = expanded === r.id;
          const docs: any[] = p?.documents ?? [];
          return (
            <div key={r.id}>
              <button onClick={() => setExpanded(isOpen ? null : r.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40">
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                {icon}
                <span className="flex-1 truncate text-xs">{r.label}</span>
                {p ? (
                  <>
                    <Badge variant="outline" className="text-[10px]">{docs.length} doc{docs.length === 1 ? "" : "s"}</Badge>
                    <Badge variant="outline" className="text-[10px]">{p.traceability?.mappings ?? 0} mappings</Badge>
                  </>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">no provenance</Badge>
                )}
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-border/40 bg-muted/20 px-4 py-2.5 text-[11px]">
                  {!p && <p className="text-muted-foreground">Generated before provenance tracking was enabled.</p>}
                  {p && (
                    <>
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">{p.generator}</span> · job {p.job_id ?? "—"} ·{" "}
                        {p.generated_at ? new Date(p.generated_at).toLocaleString() : "unknown time"}
                      </p>
                      <div>
                        <p className="pb-1 font-medium">Source document versions</p>
                        {docs.length === 0 && <p className="text-muted-foreground">None recorded.</p>}
                        <ul className="space-y-0.5">
                          {docs.map((d: any) => (
                            <li key={d.document_id} className="flex items-center gap-2">
                              <FileText className="h-3 w-3 text-violet-400" />
                              <span className="font-mono">{d.slug}.md</span>
                              <span className="text-muted-foreground">{d.title}</span>
                              <Badge variant="outline" className="text-[10px]">v{d.version ?? "?"}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="pb-1 font-medium">Traceability snapshot</p>
                        <p className="text-muted-foreground">
                          {p.traceability?.mappings ?? 0} requirement mappings captured{" "}
                          {p.traceability?.captured_at ? new Date(p.traceability.captured_at).toLocaleString() : ""}
                          {Array.isArray(p.source_requirements) && p.source_requirements.length
                            ? ` · ${p.source_requirements.length} linked to test cases`
                            : ""}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-accent" /> Generation provenance
          </DialogTitle>
          <DialogDescription>
            The document versions and traceability mappings each suite, case and spec was generated from.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="cases">
            <TabsList>
              <TabsTrigger value="suites">Suites ({data?.suites.length ?? 0})</TabsTrigger>
              <TabsTrigger value="cases">Test cases ({data?.cases.length ?? 0})</TabsTrigger>
              <TabsTrigger value="specs">Playwright ({data?.specs.length ?? 0})</TabsTrigger>
            </TabsList>
            <TabsContent value="suites">{renderList(data?.suites ?? [], <FolderTree className="h-3.5 w-3.5 text-cyan-400" />)}</TabsContent>
            <TabsContent value="cases">{renderList(data?.cases ?? [], <FlaskConical className="h-3.5 w-3.5 text-emerald-400" />)}</TabsContent>
            <TabsContent value="specs">{renderList(data?.specs ?? [], <FileCode2 className="h-3.5 w-3.5 text-amber-400" />)}</TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
