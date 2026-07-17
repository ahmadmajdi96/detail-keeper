import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Mail, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { setCurrentWorkspaceId, refresh } = useWorkspace();

  const [preview, setPreview] = useState<{
    workspace_name?: string;
    email?: string;
    role?: string;
    status?: string;
    expires_at?: string;
  } | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  // Preview the invitation (read-only via RLS: invitees can view own pending invites; anon read blocked)
  useEffect(() => {
    if (!token || !isAuthenticated) return;
    (async () => {
      const { data, error } = await supabase
        .from("workspace_invitations")
        .select("email,role,status,expires_at,workspace_id")
        .eq("token", token)
        .maybeSingle();
      if (error) {
        setPreviewErr(error.message);
        return;
      }
      if (!data) {
        setPreviewErr("Invitation not found or not addressed to your account.");
        return;
      }
      const { data: ws } = await supabase
        .from("workspaces").select("name").eq("id", data.workspace_id).maybeSingle();
      setPreview({ ...data, workspace_name: ws?.name });
    })();
  }, [token, isAuthenticated]);

  const accept = async () => {
    setAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-invitation", {
        body: { token },
      });
      if (error) {
        // FunctionsHttpError body carries the real message
        const details =
          (error as any)?.context && typeof (error as any).context.text === "function"
            ? await (error as any).context.text()
            : error.message;
        let msg = details;
        try { msg = JSON.parse(details).error || msg; } catch { /* noop */ }
        throw new Error(msg || "Failed to accept invitation");
      }
      const wsId = (data as any)?.workspace_id;
      const wsName = (data as any)?.workspace_name;
      if (wsId) setCurrentWorkspaceId(wsId);
      await refresh();
      toast.success(`Joined ${wsName || "workspace"}`);
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Could not accept invitation");
      setPreviewErr(e.message || "Could not accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (!token) {
    return (
      <Shell>
        <ErrorCard title="Missing token" message="This invitation link is incomplete." />
      </Shell>
    );
  }

  if (isLoading) {
    return <Shell><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Shell>;
  }

  if (!isAuthenticated) {
    const next = `/invitations/accept?token=${encodeURIComponent(token)}`;
    return (
      <Shell>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-accent" /> You're invited
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in or create an account to accept this workspace invitation. Use the email address the invite was sent to.
            </p>
            <div className="flex gap-2">
              <Button asChild className="flex-1 ai-gradient text-white">
                <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to={`/register?next=${encodeURIComponent(next)}`}>Create account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (previewErr) {
    return <Shell><ErrorCard title="Invitation problem" message={previewErr} /></Shell>;
  }

  if (!preview) {
    return <Shell><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></Shell>;
  }

  const emailMismatch =
    preview.email && user?.email && preview.email.toLowerCase() !== user.email.toLowerCase();
  const expired = preview.expires_at && new Date(preview.expires_at).getTime() < Date.now();
  const notPending = preview.status && preview.status !== "pending";

  return (
    <Shell>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-accent" /> Workspace invitation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Workspace</div>
            <div className="text-base font-semibold">{preview.workspace_name || "—"}</div>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Role</div>
              <Badge variant="outline">{preview.role}</Badge>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">For</div>
              <div className="text-sm">{preview.email}</div>
            </div>
          </div>

          {emailMismatch && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              This invite is for <b>{preview.email}</b>, but you're signed in as <b>{user?.email}</b>.
              Sign out and sign in with the invited email.
            </div>
          )}
          {expired && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              This invitation has expired. Ask the workspace admin to send a new one.
            </div>
          )}
          {notPending && !expired && (
            <div className="rounded-md border border-muted p-3 text-sm text-muted-foreground">
              This invitation is <b>{preview.status}</b> and can no longer be used.
            </div>
          )}

          <Button
            className="w-full ai-gradient text-white"
            disabled={accepting || !!emailMismatch || !!expired || !!notPending}
            onClick={accept}
          >
            {accepting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Accepting…</>
            ) : (
              <>Accept invitation <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      {children}
    </div>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <XCircle className="h-5 w-5 text-destructive" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button asChild variant="outline" className="w-full">
          <Link to="/dashboard"><CheckCircle2 className="mr-2 h-4 w-4" /> Go to dashboard</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
