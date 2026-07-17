import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  isOwner: boolean;
}

export function OrgDangerZone({ orgId, orgName, orgSlug, isOwner }: Props) {
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const expected = (orgSlug || orgName || "").toString();

  const exportData = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-org-data", { body: { org_id: orgId } });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qualixa-org-${expected}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-org", {
        body: { org_id: orgId, confirm_slug: confirm },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Organization deleted");
      setDeleteOpen(false);
      navigate("/dashboard");
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4" /> Export organization data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download a JSON archive containing every workspace, project, document metadata, test plan, test case, cycle,
            execution, defect, and release for this organization.
          </p>
          <Button onClick={exportData} disabled={exporting}>
            {exporting ? "Preparing…" : "Export as JSON"}
          </Button>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Permanently delete this organization and every workspace, project, and record it contains.
              Any active Stripe subscription will be canceled. This cannot be undone.
            </p>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete organization</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete {orgName}?</DialogTitle>
                  <DialogDescription>
                    All workspaces, projects, documents, test artefacts, defects, and releases will be permanently destroyed.
                    Type <code className="text-foreground font-mono">{expected}</code> below to confirm.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label>Confirmation</Label>
                  <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={expected} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    disabled={deleting || confirm.trim().toLowerCase() !== expected.toLowerCase()}
                    onClick={runDelete}
                  >
                    {deleting ? "Deleting…" : "Delete forever"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
