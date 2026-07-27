import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Loader2, RotateCcw, Plus, Minus } from "lucide-react";
import { diffLines, diffStats, collapseContext } from "@/lib/diff";

type Version = {
  id: string;
  version: number;
  title: string | null;
  content: string | null;
  change_note: string | null;
  created_at: string;
  created_by: string | null;
};

interface Props {
  documentId: string;
  documentLabel: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Version history + line diff for one generated Markdown document, so each
 * phase can be reviewed against its previous revision before moving on.
 */
export function DocVersionHistory({ documentId, documentLabel, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  const { data: versions = [], isLoading } = useQuery<Version[]>({
    queryKey: ["tp-doc-versions", documentId],
    enabled: open && !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_plan_document_versions" as any)
        .select("id, version, title, content, change_note, created_at, created_by")
        .eq("document_id", documentId)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const right = versions.find((v) => v.id === rightId) ?? versions[0];
  const left =
    versions.find((v) => v.id === leftId) ??
    versions.find((v) => right && v.version === right.version - 1) ??
    versions[versions.length - 1];

  const lines = useMemo(
    () => diffLines(left?.content ?? "", right?.content ?? ""),
    [left?.content, right?.content],
  );
  const stats = useMemo(() => diffStats(lines), [lines]);
  const rows = useMemo(() => collapseContext(lines, 3), [lines]);

  const restore = useMutation({
    mutationFn: async (v: Version) => {
      const { error } = await supabase
        .from("test_plan_documents_v2" as any)
        .update({ content: v.content ?? "", title: v.title ?? undefined })
        .eq("id", documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document restored — a new version was recorded");
      qc.invalidateQueries({ queryKey: ["tp-doc-versions", documentId] });
      qc.invalidateQueries({ queryKey: ["tp-docs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-accent" /> Version history — {documentLabel}
          </DialogTitle>
          <DialogDescription>
            Compare any two revisions of this Markdown document before generating the next phase.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No versions recorded yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Compare from</p>
                <Select value={left?.id ?? ""} onValueChange={setLeftId}>
                  <SelectTrigger className="h-8 w-[240px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version} · {new Date(v.created_at).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Compare to</p>
                <Select value={right?.id ?? ""} onValueChange={setRightId}>
                  <SelectTrigger className="h-8 w-[240px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version} · {new Date(v.created_at).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  <Plus className="mr-1 h-3 w-3" />{stats.added}
                </Badge>
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  <Minus className="mr-1 h-3 w-3" />{stats.removed}
                </Badge>
                {right && right.version !== versions[0].version && (
                  <Button size="sm" variant="outline" onClick={() => restore.mutate(right)} disabled={restore.isPending}>
                    {restore.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                    Restore v{right.version}
                  </Button>
                )}
              </div>
            </div>

            <ScrollArea className="h-[52vh] rounded-md border border-border/50 bg-muted/10">
              <table className="w-full font-mono text-[12px]">
                <tbody>
                  {rows.map((r, i) =>
                    r.type === "gap" ? (
                      <tr key={`gap-${i}`}>
                        <td colSpan={3} className="bg-muted/30 px-3 py-1 text-center text-[10px] text-muted-foreground">
                          ⋯ {r.count} unchanged line{r.count === 1 ? "" : "s"}
                        </td>
                      </tr>
                    ) : (
                      <tr
                        key={i}
                        className={
                          r.type === "add" ? "bg-success/10" : r.type === "del" ? "bg-destructive/10" : ""
                        }
                      >
                        <td className="w-12 select-none border-r border-border/40 px-2 text-right text-muted-foreground/60">
                          {r.leftNo ?? ""}
                        </td>
                        <td className="w-12 select-none border-r border-border/40 px-2 text-right text-muted-foreground/60">
                          {r.rightNo ?? ""}
                        </td>
                        <td className="whitespace-pre-wrap break-words px-3 py-0.5">
                          <span className={r.type === "add" ? "text-success" : r.type === "del" ? "text-destructive" : ""}>
                            {r.type === "add" ? "+ " : r.type === "del" ? "- " : "  "}
                          </span>
                          {r.text || " "}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </ScrollArea>

            <p className="text-[11px] text-muted-foreground">
              {versions.length} version{versions.length === 1 ? "" : "s"} · latest v{versions[0].version} recorded{" "}
              {new Date(versions[0].created_at).toLocaleString()}
              {versions[0].change_note ? ` — ${versions[0].change_note}` : ""}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
