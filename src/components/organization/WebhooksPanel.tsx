import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Trash2, Webhook as WebhookIcon, Send, Loader2, RotateCw } from "lucide-react";

const EVENT_TYPES = [
  "run.finished",
  "gate.blocked",
  "release.verdict",
  "defect.created",
  "defect.assigned",
  "testplan.generated",
];

function genSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return "whsec_" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function WebhooksPanel({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [events, setEvents] = useState<string[]>(["run.finished"]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string | null>(null);

  const endpointsQ = useQuery({
    queryKey: ["webhook-endpoints", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("webhook_endpoints").select("*")
        .eq("org_id", orgId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const deliveriesQ = useQuery({
    queryKey: ["webhook-deliveries", selectedEndpoint],
    enabled: !!selectedEndpoint,
    queryFn: async () => {
      const { data, error } = await supabase.from("webhook_deliveries").select("*")
        .eq("endpoint_id", selectedEndpoint!).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createM = useMutation({
    mutationFn: async () => {
      if (!/^https?:\/\//.test(url)) throw new Error("URL must start with http:// or https://");
      const { error } = await supabase.from("webhook_endpoints").insert({
        org_id: orgId, name: name || "Webhook", url, secret: genSecret(),
        event_types: events, enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false); setUrl(""); setName(""); setEvents(["run.finished"]);
      qc.invalidateQueries({ queryKey: ["webhook-endpoints", orgId] });
      toast.success("Webhook created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleM = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("webhook_endpoints").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook-endpoints", orgId] }),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-endpoints", orgId] });
      if (selectedEndpoint) qc.invalidateQueries({ queryKey: ["webhook-deliveries", selectedEndpoint] });
      toast.success("Webhook deleted");
    },
  });

  const resendM = useMutation({
    mutationFn: async (delivery_id: string) => {
      const { data, error } = await supabase.functions.invoke("dispatch-webhooks", { body: { delivery_id } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Redelivery queued");
      if (selectedEndpoint) qc.invalidateQueries({ queryKey: ["webhook-deliveries", selectedEndpoint] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><WebhookIcon className="h-5 w-5" /> Webhook endpoints</CardTitle>
            <CardDescription>
              We POST signed JSON payloads to your URL. Verify with <code className="mx-1 rounded bg-muted px-1">X-Qualixa-Signature</code> (HMAC-SHA256 of <code>t.body</code> using the endpoint secret).
            </CardDescription>
          </div>
          {canManage && <Button onClick={() => setOpen(true)}>Add endpoint</Button>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(endpointsQ.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No webhook endpoints.</TableCell></TableRow>
              )}
              {(endpointsQ.data ?? []).map((e: any) => (
                <TableRow key={e.id} className={selectedEndpoint === e.id ? "bg-muted/40" : ""}>
                  <TableCell className="font-medium cursor-pointer" onClick={() => setSelectedEndpoint(e.id)}>{e.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs">{e.url}</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    {(e.event_types ?? []).map((t: string) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                  </TableCell>
                  <TableCell>
                    <Switch checked={e.enabled} disabled={!canManage} onCheckedChange={(v) => toggleM.mutate({ id: e.id, enabled: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedEndpoint(e.id)}>Deliveries</Button>
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => deleteM.mutate(e.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedEndpoint && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery log</CardTitle>
            <CardDescription>Most recent 50 deliveries. Click Resend to replay.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(deliveriesQ.data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No deliveries yet.</TableCell></TableRow>
                )}
                {(deliveriesQ.data ?? []).map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{new Date(d.created_at).toLocaleString()}</TableCell>
                    <TableCell><code className="text-xs">{d.event_type}</code></TableCell>
                    <TableCell>
                      <Badge variant={d.status === "delivered" ? "outline" : d.status === "failed" ? "destructive" : "secondary"}
                             className={d.status === "delivered" ? "text-emerald-500 border-emerald-500/40" : ""}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{d.response_code ?? "—"}</TableCell>
                    <TableCell className="text-xs">{d.attempts}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => resendM.mutate(d.id)} disabled={resendM.isPending}>
                        {resendM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add webhook endpoint</DialogTitle>
            <DialogDescription>We'll generate a signing secret automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Slack alerts" /></div>
            <div className="space-y-2"><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" /></div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2">
                {EVENT_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={events.includes(t)}
                      onCheckedChange={(v) => setEvents((prev) => v ? [...prev, t] : prev.filter((x) => x !== t))} />
                    <code className="text-xs">{t}</code>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createM.mutate()} disabled={createM.isPending || !url || events.length === 0}>
              {createM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} <Send className="h-4 w-4 mr-2" /> Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
