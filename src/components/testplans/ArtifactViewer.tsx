import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Archive, Download, FileText, FileCode2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props { testPlanId: string }

type SpecRunRow = {
  id: string; created_at: string; status: string; suite_run_id: string | null;
  browser?: string | null; headless?: boolean | null; retries?: number | null;
  artifacts_json: any;
  spec?: { filename: string } | null;
};

export function ArtifactViewer({ testPlanId }: Props) {
  const [open, setOpen] = useState<SpecRunRow | null>(null);
  const [activeFile, setActiveFile] = useState<{ name: string; content: string; lang: string } | null>(null);

  const { data: runs = [], isLoading } = useQuery<SpecRunRow[]>({
    queryKey: ["spec-runs-archive", testPlanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spec_runs" as any)
        .select("id, created_at, status, suite_run_id, browser, headless, retries, artifacts_json, spec:test_plan_specs(filename)")
        .eq("test_plan_id", testPlanId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const download = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = (r: SpecRunRow) => {
    const a = r.artifacts_json || {};
    const payload = JSON.stringify(a, null, 2);
    download(`spec-run-${r.id}.json`, payload);
  };

  return (
    <>
      <div className="border border-border/50 rounded-lg bg-card">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 text-sm font-medium">
          <Archive className="h-4 w-4 text-accent" /> Saved Run Artifacts
          <Badge variant="outline" className="ml-auto">{runs.length}</Badge>
        </div>
        <ScrollArea className="max-h-[280px]">
          {isLoading ? (
            <div className="p-3 text-xs text-muted-foreground">Loading…</div>
          ) : runs.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">No spec runs yet. Run a suite to capture artifacts.</div>
          ) : (
            <div className="divide-y divide-border/30">
              {runs.map(r => {
                const docs = r.artifacts_json?.documents?.length ?? 0;
                const specs = r.artifacts_json?.specs?.length ?? 0;
                return (
                  <button key={r.id} onClick={() => { setOpen(r); setActiveFile(null); }}
                    className="w-full text-left px-3 py-2 hover:bg-muted/30 text-xs flex items-center gap-2">
                    <span className="font-mono truncate flex-1">{r.spec?.filename || r.id.slice(0, 8)}</span>
                    <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                    <span className="text-muted-foreground">{docs}d · {specs}s</span>
                    <span className="text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); setActiveFile(null); } }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-4 w-4" /> Artifacts · {open?.spec?.filename || open?.id.slice(0, 8)}
              {open && (
                <Button size="sm" variant="ghost" className="ml-auto" onClick={() => downloadAll(open)}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download JSON
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {open && (
            <div className="grid grid-cols-12 gap-3 min-h-[400px]">
              <div className="col-span-4 border border-border/50 rounded">
                <ScrollArea className="h-[440px]">
                  <div className="p-2 space-y-3">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mb-1 flex items-center gap-1"><FileText className="h-3 w-3" /> Documents</div>
                      {(open.artifacts_json?.documents ?? []).map((d: any) => (
                        <button key={d.id} onClick={() => setActiveFile({ name: `${d.slug}.md`, content: d.content || "", lang: "markdown" })}
                          className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/50 truncate">📄 {d.slug}.md</button>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground mb-1 flex items-center gap-1"><FileCode2 className="h-3 w-3" /> Specs</div>
                      {(open.artifacts_json?.specs ?? []).map((s: any) => (
                        <button key={s.id} onClick={() => setActiveFile({ name: s.filename, content: s.content || "", lang: "typescript" })}
                          className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted/50 truncate">⚡ {s.filename}</button>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </div>
              <div className="col-span-8 border border-border/50 rounded overflow-hidden">
                {activeFile ? (
                  <>
                    <div className="flex items-center px-3 py-1.5 border-b border-border/50 bg-muted/20 text-xs">
                      <span className="font-mono">{activeFile.name}</span>
                      <Button size="sm" variant="ghost" className="ml-auto h-7"
                        onClick={() => download(activeFile.name, activeFile.content)}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Download
                      </Button>
                    </div>
                    <Editor height="400px" language={activeFile.lang} theme="vs-dark" value={activeFile.content}
                      options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, wordWrap: "on" }} />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Select a file to preview.</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
