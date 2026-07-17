import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link2, Copy, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  resourceType: "release" | "dashboard" | "test_plan" | "cycle_run";
  resourceId: string;
  workspaceId?: string | null;
  orgId?: string | null;
}

export function ShareLinkPanel({ resourceType, resourceId, workspaceId, orgId }: Props) {
  const { user } = useAuth();
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expiresIn, setExpiresIn] = useState("7"); // days

  const load = async () => {
    const { data } = await supabase
      .from("share_links" as any)
      .select("*")
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId)
      .order("created_at", { ascending: false });
    setLinks((data as any[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [resourceType, resourceId]);

  const create = async () => {
    setCreating(true);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const days = parseInt(expiresIn, 10);
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400 * 1000).toISOString() : null;
    const { error } = await supabase.from("share_links" as any).insert({
      resource_type: resourceType,
      resource_id: resourceId,
      token,
      expires_at,
      workspace_id: workspaceId,
      org_id: orgId,
      created_by: user?.id,
    } as any);
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Share link created");
    load();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.from("share_links" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Link revoked");
    load();
  };

  const copyUrl = (token: string) => {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Copied share URL");
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Public share links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-xs">Expires in</Label>
            <Select value={expiresIn} onValueChange={setExpiresIn}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="0">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={create} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create link
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : links.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No share links yet.</p>
        ) : (
          <ul className="space-y-2">
            {links.map((l) => {
              const expired = l.expires_at && new Date(l.expires_at) < new Date();
              return (
                <li key={l.id} className="flex items-center gap-2 rounded-md border border-border/50 bg-card/40 p-2">
                  <Input readOnly value={`${window.location.origin}/share/${l.token}`} className="font-mono text-xs" />
                  <Badge variant={expired ? "destructive" : "outline"} className="text-[10px] shrink-0">
                    {expired ? "expired" : l.expires_at ? `exp ${formatDistanceToNow(new Date(l.expires_at), { addSuffix: true })}` : "never"}
                  </Badge>
                  <Button size="icon" variant="ghost" onClick={() => copyUrl(l.token)}><Copy className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => revoke(l.id)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-muted-foreground">
          Anyone with the link can view a read-only snapshot. No login required. Revoke anytime.
        </p>
      </CardContent>
    </Card>
  );
}
