import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectScope } from "@/hooks/useProjectScope";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Webhook, Plus, Copy, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

// SHA-256 hash to base64 (for secret_hash storage). Browser crypto.
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function genToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function CIIntegrationsManager() {
  const { projectId } = useProjectScope();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", provider: "github" });
  const [revealed, setRevealed] = useState<{ webhook_url: string; secret: string; name: string } | null>(null);

  const webhookBase = `${(import.meta as any).env?.VITE_SUPABASE_URL || ""}/functions/v1/ci-webhook`;

  const load = async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase.from("ci_integrations").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [projectId]);

  const create = async () => {
    if (!projectId) return toast.error("Select a project first");
    if (!form.name.trim()) return toast.error("Name is required");
    const secret = genToken();
    const secret_hash = await sha256(secret);
    const { data, error } = await supabase.from("ci_integrations").insert({
      project_id: projectId,
      name: form.name,
      provider: form.provider,
      secret_hash,
      branch_release_map: {},
      created_by: user?.id,
    } as any).select("*").single();
    if (error) return toast.error(error.message);
    setOpen(false);
    setForm({ name: "", provider: "github" });
    setRevealed({
      webhook_url: `${webhookBase}?integration_id=${data.id}`,
      secret,
      name: data.name,
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this CI integration?")) return;
    const { error } = await supabase.from("ci_integrations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  if (!projectId) {
    return (
      <Card><CardContent className="p-6 text-muted-foreground">Select a project to manage CI integrations.</CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Webhook className="h-4 w-4" /> CI Webhook Integrations</CardTitle>
          <CardDescription>Stream builds & test results from any CI provider into Qualixa.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Integration</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No CI integrations yet. Click <strong>New Integration</strong> to mint a webhook URL.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between p-3 border border-border/50 rounded-lg">
                <div className="min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {it.name} <Badge variant="outline" className="text-xs">{it.provider}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                    {webhookBase}?integration_id={it.id}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title="Copy webhook URL"
                    onClick={() => copy(`${webhookBase}?integration_id=${it.id}`)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(it.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New CI Integration</DialogTitle>
            <DialogDescription>Generates a webhook URL and a one-time signing secret.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. GitHub - main" /></div>
            <div><Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="github">GitHub Actions</SelectItem>
                  <SelectItem value="gitlab">GitLab CI</SelectItem>
                  <SelectItem value="jenkins">Jenkins</SelectItem>
                  <SelectItem value="circleci">CircleCI</SelectItem>
                  <SelectItem value="generic">Generic</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time secret reveal */}
      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Integration created: {revealed?.name}</DialogTitle>
            <DialogDescription>Save the signing secret now — it won't be shown again.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Webhook URL</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={revealed?.webhook_url || ""} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => revealed && copy(revealed.webhook_url)}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <Label>Signing Secret (one-time)</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={revealed?.secret || ""} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={() => revealed && copy(revealed.secret)}><Copy className="h-4 w-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Send as <code>X-CI-Signature: sha256=&lt;HMAC(secret, body)&gt;</code> header on every webhook request.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}><Check className="mr-2 h-4 w-4" /> I've saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
