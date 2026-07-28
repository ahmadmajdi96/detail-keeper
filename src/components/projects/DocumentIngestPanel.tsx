import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, FileArchive, FileText, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
  repoJobStatus: string | null;
  canEdit: boolean;
}

type Mode = "repo-zip" | "brd-file" | "brd-text";

const DONE = ["succeeded", "completed", "success", "ready"];
const FAILED = ["failed", "error", "canceled", "cancelled"];

export function ingestStatusLabel(status: string | null | undefined) {
  const s = (status || "").toLowerCase();
  if (!s) return null;
  if (DONE.includes(s)) return { label: "Processed", tone: "done" as const, Icon: CheckCircle2 };
  if (FAILED.includes(s)) return { label: "Failed", tone: "failed" as const, Icon: XCircle };
  return { label: "Processing", tone: "running" as const, Icon: Clock };
}

export function IngestStatusBadge({ status }: { status: string | null | undefined }) {
  const s = ingestStatusLabel(status);
  if (!s) return null;
  const { label, tone, Icon } = s;
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] gap-1",
        tone === "done" && "border-emerald-500/40 text-emerald-500",
        tone === "failed" && "border-destructive/40 text-destructive",
        tone === "running" && "border-amber-500/40 text-amber-500",
      )}
    >
      <Icon className={cn("h-3 w-3", tone === "running" && "animate-pulse")} />
      {label}
    </Badge>
  );
}

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });

export function DocumentIngestPanel({ projectId, repoJobStatus, canEdit }: Props) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("repo-zip");
  const [busy, setBusy] = useState(false);
  const [brdText, setBrdText] = useState("");
  const [brdName, setBrdName] = useState("system-brd.md");
  const repoInput = useRef<HTMLInputElement>(null);
  const brdInput = useRef<HTMLInputElement>(null);

  const submit = async (action: string, payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("repo-reader", {
        body: { action, project_id: projectId, ...payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Upload accepted — processing documents…");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["generated-docs", projectId] });
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file: File | undefined, action: "upload" | "brd-upload") => {
    if (!file) return;
    const file_base64 = await fileToBase64(file);
    await submit(action, { filename: file.name, content_type: file.type, file_base64 });
  };

  const modes: { key: Mode; label: string; Icon: typeof FileArchive; hint: string }[] = [
    { key: "repo-zip", label: "Repository ZIP", Icon: FileArchive, hint: "Generates 5 documents" },
    { key: "brd-file", label: "BRD file / ZIP", Icon: FileText, hint: "Generates 4 documents" },
    { key: "brd-text", label: "BRD text", Icon: FileText, hint: "Paste markdown BRD" },
  ];

  if (!canEdit) return null;

  return (
    <Card className="border-accent/20 overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-accent/10 via-primary/5 to-transparent flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-accent" />
          <span className="font-semibold text-sm">Upload documents</span>
        </div>
        <IngestStatusBadge status={repoJobStatus} />
      </div>
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={cn(
                "flex-1 min-w-[160px] text-left rounded-lg border p-3 transition-all duration-200",
                mode === m.key
                  ? "border-accent bg-accent/10"
                  : "border-border hover:border-accent/50 bg-card",
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <m.Icon className="h-4 w-4 text-accent" />
                {m.label}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{m.hint}</div>
            </button>
          ))}
        </div>

        {mode === "repo-zip" && (
          <div className="flex items-center gap-2">
            <input
              ref={repoInput}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0], "upload")}
            />
            <Button size="sm" disabled={busy} onClick={() => repoInput.current?.click()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Choose repository ZIP
            </Button>
            <span className="text-xs text-muted-foreground">Sent to the repository pipeline.</span>
          </div>
        )}

        {mode === "brd-file" && (
          <div className="flex items-center gap-2">
            <input
              ref={brdInput}
              type="file"
              accept=".md,.txt,.zip,.pdf,.docx"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0], "brd-upload")}
            />
            <Button size="sm" disabled={busy} onClick={() => brdInput.current?.click()}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Choose BRD file or ZIP
            </Button>
            <span className="text-xs text-muted-foreground">Sent to the BRD pipeline.</span>
          </div>
        )}

        {mode === "brd-text" && (
          <div className="space-y-2">
            <Input
              value={brdName}
              onChange={(e) => setBrdName(e.target.value)}
              placeholder="system-brd.md"
              className="max-w-xs"
            />
            <Textarea
              value={brdText}
              onChange={(e) => setBrdText(e.target.value)}
              placeholder={"# BRD\n\n## UI Pages\n- Login page `/login`…"}
              className="min-h-[140px] font-mono text-xs"
            />
            <Button
              size="sm"
              disabled={busy || !brdText.trim()}
              onClick={() => submit("brd-generate", { filename: brdName || "system-brd.md", content: brdText })}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Generate from BRD text
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
