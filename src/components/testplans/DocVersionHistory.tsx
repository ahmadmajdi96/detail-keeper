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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  History, Loader2, RotateCcw, Plus, Minus, MessageSquare, MessageSquarePlus,
  Check, ThumbsUp, ThumbsDown, CircleDot,
} from "lucide-react";
import { diffLines, diffStats, collapseContext } from "@/lib/diff";
import { useAuth } from "@/contexts/AuthContext";

type Decision = "comment" | "accept" | "reject";

type DiffComment = {
  id: string;
  line_key: string;
  line_text: string | null;
  body: string;
  decision: Decision;
  parent_id: string | null;
  resolved: boolean;
  author_id: string;
  created_at: string;
  left_version: number | null;
  right_version: number | null;
};

const DECISION_META: Record<Decision, { label: string; icon: JSX.Element; cls: string }> = {
  comment: { label: "Comment", icon: <CircleDot className="h-3 w-3" />, cls: "text-muted-foreground" },
  accept: { label: "Accept", icon: <ThumbsUp className="h-3 w-3" />, cls: "text-success" },
  reject: { label: "Reject", icon: <ThumbsDown className="h-3 w-3" />, cls: "text-destructive" },
};

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
  const { user } = useAuth();
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);
  const [composeFor, setComposeFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [draftDecision, setDraftDecision] = useState<Decision>("comment");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

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

  const { data: comments = [] } = useQuery<DiffComment[]>({
    queryKey: ["doc-diff-comments", documentId],
    enabled: open && !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doc_diff_comments" as any)
        .select("id, line_key, line_text, body, decision, parent_id, resolved, author_id, created_at, left_version, right_version")
        .eq("document_id", documentId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const { data: authors = {} } = useQuery<Record<string, string>>({
    queryKey: ["doc-diff-comment-authors", documentId, comments.length],
    enabled: open && comments.length > 0,
    queryFn: async () => {
      const ids = Array.from(new Set(comments.map((c) => c.author_id)));
      const { data } = await supabase.from("profiles").select("id, name, email").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.name || p.email || "Unknown"; });
      return map;
    },
  });

  /** Stable key so a thread stays attached to its line across re-renders. */
  const lineKey = (r: any) => `${r.type}:${r.leftNo ?? "-"}:${r.rightNo ?? "-"}`;

  const threads = useMemo(() => {
    const roots = comments.filter((c) => !c.parent_id);
    const byKey = new Map<string, { root: DiffComment; replies: DiffComment[] }[]>();
    roots.forEach((root) => {
      const entry = { root, replies: comments.filter((c) => c.parent_id === root.id) };
      const list = byKey.get(root.line_key) ?? [];
      list.push(entry);
      byKey.set(root.line_key, list);
    });
    return byKey;
  }, [comments]);

  const openThreadCount = comments.filter((c) => !c.parent_id && !c.resolved).length;

  const addComment = useMutation({
    mutationFn: async (payload: { key: string; text: string | null; body: string; decision: Decision; parentId: string | null }) => {
      const { error } = await supabase.from("doc_diff_comments" as any).insert({
        document_id: documentId,
        line_key: payload.key,
        line_text: payload.text,
        body: payload.body,
        decision: payload.decision,
        parent_id: payload.parentId,
        left_version: left?.version ?? null,
        right_version: right?.version ?? null,
        author_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft(""); setComposeFor(null); setReplyTo(null); setDraftDecision("comment");
      qc.invalidateQueries({ queryKey: ["doc-diff-comments", documentId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleResolved = useMutation({
    mutationFn: async (c: DiffComment) => {
      const { error } = await supabase.from("doc_diff_comments" as any).update({
        resolved: !c.resolved,
        resolved_by: c.resolved ? null : user?.id ?? null,
        resolved_at: c.resolved ? null : new Date().toISOString(),
      }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["doc-diff-comments", documentId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async (v: Version) => {
      // Restores are justified in-thread: record the rationale alongside the diff.
      await supabase.from("doc_diff_comments" as any).insert({
        document_id: documentId,
        line_key: "__restore__",
        body: `Restored v${v.version} over v${versions[0]?.version ?? "?"}`,
        decision: "accept",
        left_version: v.version,
        right_version: versions[0]?.version ?? null,
        author_id: user?.id,
      });
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
      qc.invalidateQueries({ queryKey: ["doc-diff-comments", documentId] });
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
                <Badge variant="outline" className="text-[10px]">
                  <MessageSquare className="mr-1 h-3 w-3" />{openThreadCount} open thread{openThreadCount === 1 ? "" : "s"}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Switch id="show-resolved" checked={showResolved} onCheckedChange={setShowResolved} />
                  <Label htmlFor="show-resolved" className="text-[11px] text-muted-foreground">Show resolved</Label>
                </div>
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
                          <div className="group flex items-start gap-2">
                            <span className="flex-1">
                              <span className={r.type === "add" ? "text-success" : r.type === "del" ? "text-destructive" : ""}>
                                {r.type === "add" ? "+ " : r.type === "del" ? "- " : "  "}
                              </span>
                              {r.text || " "}
                            </span>
                            <button
                              type="button"
                              title="Comment on this line"
                              onClick={() => {
                                const k = lineKey(r);
                                setComposeFor(composeFor === k ? null : k);
                                setReplyTo(null); setDraft(""); setDraftDecision("comment");
                              }}
                              className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                            >
                              <MessageSquarePlus className="h-3.5 w-3.5 text-muted-foreground hover:text-accent" />
                            </button>
                          </div>

                          {(threads.get(lineKey(r)) ?? [])
                            .filter((t) => showResolved || !t.root.resolved)
                            .map((t) => (
                              <div key={t.root.id}
                                className={`mt-1.5 rounded-md border p-2 font-sans text-[11px] ${t.root.resolved ? "border-border/40 bg-muted/20 opacity-70" : "border-accent/30 bg-accent/5"}`}>
                                {[t.root, ...t.replies].map((c) => (
                                  <div key={c.id} className="border-b border-border/30 py-1 last:border-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className={DECISION_META[c.decision].cls}>{DECISION_META[c.decision].icon}</span>
                                      <span className="font-medium">{authors[c.author_id] ?? "Someone"}</span>
                                      <span className="text-muted-foreground">{DECISION_META[c.decision].label.toLowerCase()}</span>
                                      <span className="text-muted-foreground">· {new Date(c.created_at).toLocaleString()}</span>
                                    </div>
                                    <p className="whitespace-pre-wrap pt-0.5">{c.body}</p>
                                  </div>
                                ))}
                                <div className="flex items-center gap-1.5 pt-1.5">
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                                    onClick={() => { setReplyTo(t.root.id); setComposeFor(t.root.line_key); setDraft(""); }}>
                                    Reply
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                                    onClick={() => toggleResolved.mutate(t.root)}>
                                    <Check className="mr-1 h-3 w-3" />{t.root.resolved ? "Reopen" : "Resolve"}
                                  </Button>
                                </div>
                              </div>
                            ))}

                          {composeFor === lineKey(r) && (
                            <div className="mt-1.5 space-y-1.5 rounded-md border border-border/50 bg-card p-2 font-sans">
                              <Textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder={replyTo ? "Reply to this thread…" : "Justify this change, or accept / reject it…"}
                                className="min-h-[56px] text-xs"
                              />
                              <div className="flex items-center gap-1.5">
                                {(["comment", "accept", "reject"] as Decision[]).map((d) => (
                                  <Button key={d} size="sm"
                                    variant={draftDecision === d ? "secondary" : "ghost"}
                                    className="h-6 px-2 text-[10px]"
                                    onClick={() => setDraftDecision(d)}>
                                    <span className={`mr-1 ${DECISION_META[d].cls}`}>{DECISION_META[d].icon}</span>
                                    {DECISION_META[d].label}
                                  </Button>
                                ))}
                                <Button size="sm" className="ml-auto h-6 px-2 text-[10px]"
                                  disabled={!draft.trim() || addComment.isPending}
                                  onClick={() => addComment.mutate({
                                    key: lineKey(r), text: r.text ?? null, body: draft.trim(),
                                    decision: draftDecision, parentId: replyTo,
                                  })}>
                                  {addComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Post"}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                                  onClick={() => { setComposeFor(null); setReplyTo(null); }}>Cancel</Button>
                              </div>
                            </div>
                          )}
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
