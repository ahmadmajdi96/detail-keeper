import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Save, Trash2, FileCode2, Search, GitBranch } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  repoJobId: string | null;
  repoJobStatus: string | null;
  repoJobProgress: number | null;
  canEdit: boolean;
}

type RepoFile = { path: string; size?: number; type?: string };

export function RepoFilesPanel({ projectId, repoJobId, repoJobStatus, repoJobProgress, canEdit }: Props) {
  const qc = useQueryClient();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState("");

  const isReady = ["completed", "ready", "success", "succeeded"].includes(repoJobStatus || "") || repoJobProgress === 100;
  const isRunning = !isReady && !!repoJobId && repoJobStatus !== "failed" && repoJobStatus !== "error";

  // Poll job status until ready
  useEffect(() => {
    if (!repoJobId || isReady) return;
    const iv = setInterval(async () => {
      await supabase.functions.invoke("repo-reader", { body: { action: "job", project_id: projectId } });
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    }, 3500);
    return () => clearInterval(iv);
  }, [repoJobId, isReady, projectId, qc]);

  const filesQ = useQuery({
    queryKey: ["repo-files", projectId, repoJobId],
    enabled: !!repoJobId && isReady,
    queryFn: async (): Promise<RepoFile[]> => {
      const { data, error } = await supabase.functions.invoke("repo-reader", {
        body: { action: "list", project_id: projectId },
      });
      if (error) throw error;
      const files = data?.files || data?.items || data || [];
      return (Array.isArray(files) ? files : []).map((f: any) =>
        typeof f === "string" ? { path: f } : { path: f.path || f.name, size: f.size, type: f.type }
      );
    },
  });

  const filtered = useMemo(() => {
    const list = filesQ.data || [];
    if (!filter) return list;
    const q = filter.toLowerCase();
    return list.filter((f) => f.path.toLowerCase().includes(q));
  }, [filesQ.data, filter]);

  const loadFile = async (path: string) => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setSelectedPath(path);
    setBuffer("Loading...");
    setDirty(false);
    const { data, error } = await supabase.functions.invoke("repo-reader", {
      body: { action: "get", project_id: projectId, path },
    });
    if (error) { toast.error(error.message); setBuffer(""); return; }
    setBuffer(typeof data === "string" ? data : (data?.content ?? JSON.stringify(data, null, 2)));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedPath) throw new Error("No file selected");
      const { error } = await supabase.functions.invoke("repo-reader", {
        body: { action: "put", project_id: projectId, path: selectedPath, content: buffer },
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); setDirty(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!selectedPath) throw new Error("No file selected");
      const { error } = await supabase.functions.invoke("repo-reader", {
        body: { action: "delete", project_id: projectId, path: selectedPath },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      setSelectedPath(null); setBuffer(""); setDirty(false);
      qc.invalidateQueries({ queryKey: ["repo-files", projectId, repoJobId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!repoJobId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-40" />
          No repository is linked to this project. Create the project with a GitHub source to enable file browsing.
        </CardContent>
      </Card>
    );
  }

  if (isRunning) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm">
          <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-accent" />
          <div className="font-medium">Cloning repository…</div>
          <div className="text-xs text-muted-foreground mt-1">
            Status: {repoJobStatus || "queued"}{repoJobProgress != null ? ` · ${repoJobProgress}%` : ""}
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

  return (
    <div className="grid gap-3 md:grid-cols-[320px_1fr]">
      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><FileCode2 className="h-4 w-4" /> Files ({filesQ.data?.length ?? 0})</CardTitle>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => filesQ.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="relative mt-2">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Filter files…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 pl-7 text-xs" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            {filesQ.isLoading && <div className="p-3 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</div>}
            {filesQ.error && <div className="p-3 text-xs text-destructive">{(filesQ.error as any).message}</div>}
            {filtered.map((f) => (
              <button
                key={f.path}
                onClick={() => loadFile(f.path)}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate border-l-2 transition-colors ${selectedPath === f.path ? "bg-accent/10 border-accent text-foreground" : "border-transparent hover:bg-muted/50 text-muted-foreground"}`}
                title={f.path}
              >
                {f.path}
              </button>
            ))}
            {!filesQ.isLoading && filtered.length === 0 && (
              <div className="p-3 text-xs text-muted-foreground">No files.</div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm truncate">
            {selectedPath || <span className="text-muted-foreground">Select a file</span>}
            {dirty && <Badge variant="outline" className="ml-2 text-[10px]">unsaved</Badge>}
          </CardTitle>
          {selectedPath && canEdit && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => del.mutate()} disabled={del.isPending}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
              <Button size="sm" className="ai-gradient text-white" onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
                {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <textarea
            value={buffer}
            onChange={(e) => { setBuffer(e.target.value); setDirty(true); }}
            disabled={!selectedPath || !canEdit}
            className="w-full h-[520px] font-mono text-xs p-3 rounded border border-border bg-muted/20 resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder={selectedPath ? "" : "Pick a file on the left to view/edit its contents."}
            spellCheck={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
