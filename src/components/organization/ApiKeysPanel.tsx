import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Copy, Trash2, KeyRound, Loader2, ShieldCheck } from "lucide-react";

const SCOPES = [
  "projects:read",
  "testplans:read",
  "testcases:read",
  "defects:read",
  "defects:write",
];

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `qxa_${b64}`;
}

export function ApiKeysPanel({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["projects:read"]);
  const [issued, setIssued] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["api-keys", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_keys").select("*")
        .eq("org_id", orgId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createM = useMutation({
    mutationFn: async () => {
      const raw = generateApiKey();
      const hash = await sha256Hex(raw);
      const prefix = raw.slice(0, 12); // "qxa_" + 8 chars
      const { error } = await supabase.from("api_keys").insert({
        org_id: orgId, name: name || "Untitled key",
        key_prefix: prefix, key_hash: hash, scopes,
      });
      if (error) throw error;
      return raw;
    },
    onSuccess: (raw) => {
      setIssued(raw);
      setName("");
      setScopes(["projects:read"]);
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Key revoked");
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> API Keys</CardTitle>
          <CardDescription>
            Bearer tokens for CI, agents and MCP clients. Send as
            <code className="mx-1 rounded bg-muted px-1">Authorization: Bearer qxa_...</code>
            to <code className="rounded bg-muted px-1">/functions/v1/api-v1</code>.
          </CardDescription>
        </div>
        {canManage && (
          <Button onClick={() => { setIssued(null); setOpen(true); }}>Create key</Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Scopes</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(listQ.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No API keys yet.</TableCell></TableRow>
            )}
            {(listQ.data ?? []).map((k: any) => (
              <TableRow key={k.id}>
                <TableCell className="font-medium">{k.name}</TableCell>
                <TableCell><code className="text-xs">{k.key_prefix}…</code></TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {(k.scopes ?? []).map((s: string) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}</TableCell>
                <TableCell>
                  {k.revoked_at
                    ? <Badge variant="destructive">Revoked</Badge>
                    : <Badge variant="outline" className="text-emerald-500 border-emerald-500/40"><ShieldCheck className="h-3 w-3 mr-1" />Active</Badge>}
                </TableCell>
                <TableCell>
                  {canManage && !k.revoked_at && (
                    <Button variant="ghost" size="sm" onClick={() => revokeM.mutate(k.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setIssued(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{issued ? "Copy your API key" : "Create API key"}</DialogTitle>
            <DialogDescription>
              {issued
                ? "This is the only time the full key will be shown. Store it somewhere safe."
                : "Choose a name and the scopes this key can use."}
            </DialogDescription>
          </DialogHeader>

          {issued ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-muted p-3 font-mono text-xs break-all">{issued}</div>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(issued); toast.success("Copied"); }}>
                <Copy className="h-4 w-4 mr-2" /> Copy to clipboard
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="CI runner" />
              </div>
              <div className="space-y-2">
                <Label>Scopes</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SCOPES.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={scopes.includes(s)}
                        onCheckedChange={(v) => setScopes((prev) => v ? [...prev, s] : prev.filter((x) => x !== s))}
                      />
                      <code className="text-xs">{s}</code>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {issued ? (
              <Button onClick={() => { setOpen(false); setIssued(null); }}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => createM.mutate()} disabled={createM.isPending || scopes.length === 0}>
                  {createM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
