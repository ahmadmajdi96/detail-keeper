import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { MentionTextarea, renderMentionBody } from "@/components/mentions/MentionTextarea";
import { formatDistanceToNow } from "date-fns";

interface Props {
  defectId: string;
  projectId?: string | null;
  workspaceId?: string | null;
}

export function DefectCommentsPanel({ defectId, projectId, workspaceId }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("defect_comments")
      .select("*, author:profiles!defect_comments_author_id_fkey(id,name,email)")
      .eq("defect_id", defectId)
      .order("created_at", { ascending: true });
    if (!error) setComments(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [defectId]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase.channel(`defect-comments-${defectId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "defect_comments", filter: `defect_id=eq.${defectId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [defectId]);

  const submit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("defect_comments").insert({
      defect_id: defectId,
      author_id: user?.id,
      body: body.trim(),
      metadata: { mentions } as any,
    } as any);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setBody("");
    setMentions([]);
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Comments
          <span className="text-xs text-muted-foreground font-normal ml-1">({comments.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No comments yet. Be the first to add context.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3 rounded-md border border-border/50 bg-card/30 p-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs">{(c.author?.name || c.author?.email || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{c.author?.name || c.author?.email || "Unknown"}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="mt-1 text-sm whitespace-pre-wrap break-words">{renderMentionBody(c.body)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <MentionTextarea
            value={body}
            onChange={setBody}
            projectId={projectId}
            workspaceId={workspaceId}
            onMentionsChange={setMentions}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {mentions.length > 0 ? `${mentions.length} mention${mentions.length > 1 ? "s" : ""} will be notified.` : "Type @ to mention someone."}
            </p>
            <Button onClick={submit} disabled={submitting || !body.trim()} size="sm">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Post comment
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
