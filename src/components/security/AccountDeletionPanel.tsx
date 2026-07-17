import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function AccountDeletionPanel() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<any[] | null>(null);

  const run = async () => {
    setBusy(true); setBlockers(null);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm } });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error) {
        if (payload.blockers) setBlockers(payload.blockers);
        throw new Error(payload.error);
      }
      toast.success("Account deleted");
      setOpen(false);
      await logout();
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e.message || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" /> Delete my account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Permanently remove your Qualixa account, personal data, and any organization where you are the sole member.
          If you are the sole owner of an organization that contains other members or workspaces, you must transfer or delete it first.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete my account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Type <code className="text-foreground font-mono">delete my account</code> to confirm. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {blockers && blockers.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  You still own {blockers.length} organization(s) with other members or workspaces:
                  <ul className="list-disc pl-5 mt-1">
                    {blockers.map((b) => <li key={b.id}>{b.name}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Confirmation</Label>
              <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="delete my account" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={busy || confirm.trim().toLowerCase() !== "delete my account"}
                onClick={run}
              >
                {busy ? "Deleting…" : "Delete forever"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
