import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  ArrowRight,
  FileText,
  FileArchive,
  Github,
  Upload,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  onCreated?: (projectId: string) => void;
}

type Source = "documentation" | "zip" | "github";

export function ProjectWizard({ open, onOpenChange, workspaceId, onCreated }: Props) {
  const { user } = useAuth();
  const { currentWorkspace, refresh } = useWorkspace();
  const wsId = workspaceId || currentWorkspace?.id;
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState<Source>("documentation");

  // github
  const [githubUrl, setGithubUrl] = useState("");
  const [githubBranch, setGithubBranch] = useState("main");
  const [isPrivate, setIsPrivate] = useState(false);
  const [githubToken, setGithubToken] = useState("");

  // zip
  const [zipFile, setZipFile] = useState<File | null>(null);

  // docs
  const [docFiles, setDocFiles] = useState<File[]>([]);

  const reset = () => {
    setStep(1); setName(""); setDescription(""); setSource("documentation");
    setGithubUrl(""); setGithubBranch("main"); setIsPrivate(false); setGithubToken("");
    setZipFile(null); setDocFiles([]);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!wsId) throw new Error("No workspace selected");

      // 1. Insert project
      const projectInsert: any = {
        workspace_id: wsId,
        name,
        description,
        source_type: source,
        status: "pending",
        created_by: user?.id,
      };
      if (source === "github") {
        projectInsert.github_url = githubUrl;
        projectInsert.github_branch = githubBranch;
        projectInsert.github_is_private = isPrivate;
        // NOTE: token stored on row, protected by RLS
        if (isPrivate && githubToken) {
          projectInsert.github_token_secret_name = githubToken;
        }
      }

      const { data: proj, error } = await supabase
        .from("projects")
        .insert(projectInsert)
        .select("id")
        .single();
      if (error) throw error;
      const projectId = proj.id;

      // 2. Source-specific ingestion
      if (source === "zip" && zipFile) {
        const path = `${wsId}/${projectId}/${Date.now()}-${zipFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("project-repos")
          .upload(path, zipFile, { upsert: false });
        if (upErr) throw upErr;
        await supabase
          .from("projects")
          .update({ zip_storage_path: path, status: "processing" })
          .eq("id", projectId);
        // fire-and-forget ingest
        supabase.functions
          .invoke("ingest-zip", { body: { project_id: projectId } })
          .catch(() => {});
      } else if (source === "github") {
        await supabase.from("projects").update({ status: "processing" }).eq("id", projectId);
        supabase.functions
          .invoke("ingest-github", {
            body: {
              project_id: projectId,
              url: githubUrl,
              branch: githubBranch,
              token: isPrivate ? githubToken : null,
            },
          })
          .catch(() => {});
      } else if (source === "documentation" && docFiles.length) {
        // upload each doc to existing documents table
        for (const f of docFiles) {
          const { data: docRow } = await supabase
            .from("documents")
            .insert({
              filename: f.name,
              file_size: f.size,
              mime_type: f.type || "application/octet-stream",
              status: "pending",
              uploader_id: user?.id,
              workspace_id: wsId,
              project_id: projectId,
            })
            .select("id")
            .single();
          if (docRow) {
            supabase.functions
              .invoke("process-document", { body: { document_id: docRow.id } })
              .catch(() => {});
          }
        }
        await supabase.from("projects").update({ status: "ready" }).eq("id", projectId);
      }

      return projectId;
    },
    onSuccess: async (id) => {
      toast.success("Project created");
      await refresh();
      onCreated?.(id);
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message || "Failed to create project"),
  });

  const canNext1 = name.trim().length > 0;
  const canCreate =
    (source === "documentation") ||
    (source === "zip" && !!zipFile) ||
    (source === "github" && /^https?:\/\//.test(githubUrl) && (!isPrivate || githubToken.length > 0));

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Step {step} of 3 — {step === 1 ? "Project details" : step === 2 ? "Choose source" : "Configure source"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 my-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${step >= s ? "bg-accent" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Project name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payments API v2" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid md:grid-cols-3 gap-3 py-2">
            {([
              { id: "documentation", title: "Documentation", desc: "Upload API docs, specs, requirements", icon: FileText },
              { id: "zip", title: "Repo ZIP", desc: "Upload a zipped codebase", icon: FileArchive },
              { id: "github", title: "GitHub", desc: "Connect a public or private repo", icon: Github },
            ] as const).map((opt) => {
              const Icon = opt.icon;
              const active = source === opt.id;
              return (
                <Card
                  key={opt.id}
                  onClick={() => setSource(opt.id)}
                  className={`p-4 cursor-pointer transition-all relative ${
                    active ? "border-accent ring-2 ring-accent/40" : "hover:border-accent/40"
                  }`}
                >
                  {active && <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-accent" />}
                  <Icon className="h-8 w-8 text-accent mb-3" />
                  <div className="font-medium text-sm">{opt.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{opt.desc}</div>
                </Card>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 py-2">
            {source === "documentation" && (
              <div className="space-y-2">
                <Label>Upload documents (optional — can add later)</Label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center cursor-pointer hover:border-accent/60 transition-colors"
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm">Click to select documents</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, MD, TXT, JSON</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => setDocFiles(Array.from(e.target.files || []))}
                />
                {docFiles.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {docFiles.length} file(s) selected
                  </div>
                )}
              </div>
            )}

            {source === "zip" && (
              <div className="space-y-2">
                <Label>Upload repo zip *</Label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-border/60 rounded-lg p-6 text-center cursor-pointer hover:border-accent/60 transition-colors"
                >
                  <FileArchive className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm">{zipFile ? zipFile.name : "Click to select a .zip file"}</p>
                  {zipFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {(zipFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                />
              </div>
            )}

            {source === "github" && (
              <>
                <div className="space-y-2">
                  <Label>Repository URL *</Label>
                  <Input
                    placeholder="https://github.com/owner/repo"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Input value={githubBranch} onChange={(e) => setGithubBranch(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Repository visibility</Label>
                    <div className="h-10 flex items-center gap-3 rounded-md border border-input px-3">
                      <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                      <span className="text-sm">{isPrivate ? "Private" : "Public"}</span>
                    </div>
                  </div>
                </div>
                {isPrivate && (
                  <div className="space-y-2">
                    <Label>GitHub access token *</Label>
                    <Input
                      type="password"
                      placeholder="ghp_..."
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Personal access token with <code>repo</code> scope. Stored encrypted.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          {step < 3 ? (
            <Button
              className="ai-gradient text-white"
              disabled={step === 1 && !canNext1}
              onClick={() => setStep(step + 1)}
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              className="ai-gradient text-white"
              disabled={!canCreate || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create project
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
