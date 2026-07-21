import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  ImageIcon,
  Upload,
  FileText,
  Loader2,
  Download,
  Trash2,
  Paperclip,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BUCKET = "defect-evidence";
const IMAGE_TYPES = /^image\//i;

type EvidenceRow = {
  id: string;
  file_name: string | null;
  file_type: string | null;
  storage_path: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  captured_at: string | null;
  description: string | null;
};

function formatBytes(n?: number | null) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function DefectEvidenceGallery({
  defectId,
  projectId,
  workspaceId,
}: {
  defectId: string;
  projectId?: string | null;
  workspaceId?: string | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["defect-evidence", defectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence")
        .select("id,file_name,file_type,storage_path,size_bytes,uploaded_by,captured_at,description")
        .eq("defect_id", defectId)
        .order("captured_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EvidenceRow[];
    },
  });

  // Sign URLs for all items (batch)
  useMemo(() => {
    (async () => {
      const missing = items.filter((i) => i.storage_path && !urls[i.id]);
      if (!missing.length) return;
      const next: Record<string, string> = {};
      await Promise.all(
        missing.map(async (i) => {
          const { data } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(i.storage_path!, 60 * 60);
          if (data?.signedUrl) next[i.id] = data.signedUrl;
        })
      );
      if (Object.keys(next).length) setUrls((prev) => ({ ...prev, ...next }));
    })();
  }, [items]);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      setUploading(true);
      let ok = 0;
      for (const file of files) {
        try {
          const path = `${projectId || "unknown"}/${defectId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { upsert: false, contentType: file.type });
          if (upErr) throw upErr;
          const { error: insErr } = await supabase.from("evidence").insert({
            defect_id: defectId,
            project_id: projectId ?? null,
            workspace_id: workspaceId ?? null,
            file_name: file.name,
            file_type: file.type || "application/octet-stream",
            size_bytes: file.size,
            storage_path: path,
            uploaded_by: user?.id ?? null,
          } as any);
          if (insErr) throw insErr;
          ok++;
        } catch (e: any) {
          toast.error(`Upload failed: ${e.message || e}`);
        }
      }
      setUploading(false);
      if (ok) toast.success(`Uploaded ${ok} file${ok > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["defect-evidence", defectId] });
    },
    [defectId, projectId, workspaceId, user?.id, qc]
  );

  const deleteMutation = useMutation({
    mutationFn: async (row: EvidenceRow) => {
      if (row.storage_path) {
        await supabase.storage.from(BUCKET).remove([row.storage_path]);
      }
      const { error } = await supabase.from("evidence").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evidence removed");
      qc.invalidateQueries({ queryKey: ["defect-evidence", defectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) uploadFiles(files);
  };

  const images = items.filter((i) => IMAGE_TYPES.test(i.file_type || ""));
  const others = items.filter((i) => !IMAGE_TYPES.test(i.file_type || ""));

  return (
    <Card className="border-border/50">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="h-4 w-4" /> Evidence
          {items.length > 0 && (
            <Badge variant="outline" className="ml-1">{items.length}</Badge>
          )}
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*,.log,.json,.zip"
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) uploadFiles(files);
            e.target.value = "";
          }}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground cursor-pointer transition-all",
            dragOver && "border-cyan-400/70 bg-cyan-500/5 text-cyan-200"
          )}
        >
          <Upload className="h-5 w-5 mx-auto mb-2 opacity-70" />
          Drop screenshots, logs, or files here, or click to browse
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No evidence attached yet.
          </p>
        ) : (
          <>
            {images.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <ImageIcon className="h-3 w-3" /> Screenshots
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {images.map((img) => {
                    const url = urls[img.id];
                    return (
                      <div
                        key={img.id}
                        className="group relative aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted/30"
                      >
                        {url ? (
                          <img
                            src={url}
                            alt={img.file_name || "evidence"}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                          <div className="text-[10px] text-white truncate mb-1">{img.file_name}</div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7"
                              onClick={() => url && setLightbox({ url, name: img.file_name || "" })}
                              disabled={!url}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7"
                              asChild
                              disabled={!url}
                            >
                              <a href={url} download={img.file_name || undefined} target="_blank" rel="noreferrer">
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-7 w-7 ml-auto"
                              onClick={() => deleteMutation.mutate(img)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {others.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  <FileText className="h-3 w-3" /> Files
                </div>
                <div className="space-y-1.5">
                  {others.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{f.file_name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {f.file_type} · {formatBytes(f.size_bytes)}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild disabled={!urls[f.id]}>
                        <a href={urls[f.id]} download={f.file_name || undefined} target="_blank" rel="noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(f)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-5xl p-2 bg-black/95 border-border/60">
          {lightbox && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between px-2 py-1 text-xs text-white/80">
                <span className="truncate">{lightbox.name}</span>
                <Button size="sm" variant="secondary" asChild>
                  <a href={lightbox.url} download={lightbox.name} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </a>
                </Button>
              </div>
              <ScrollArea className="max-h-[80vh]">
                <img src={lightbox.url} alt={lightbox.name} className="w-full h-auto object-contain" />
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
