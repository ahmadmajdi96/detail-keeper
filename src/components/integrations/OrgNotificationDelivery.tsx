import { useEffect, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, Mail, MessageSquare, Loader2, Slack } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "workspace_created", label: "Workspace created" },
  { key: "project_created", label: "Project created" },
  { key: "test_plan_created", label: "Test plan created" },
  { key: "member_added", label: "Member added / assigned" },
];

type Cfg = {
  email: boolean;
  slack: boolean;
  categories: Record<string, boolean>;
};

const DEFAULT: Cfg = {
  email: true,
  slack: false,
  categories: Object.fromEntries(CATEGORIES.map((c) => [c.key, true])),
};

export function OrgNotificationDelivery() {
  const { currentOrganization, currentOrgRole } = useOrganization();
  const canManage = currentOrgRole === "owner" || currentOrgRole === "security_admin";
  const orgId = currentOrganization?.id;
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const [slackUrl, setSlackUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data } = await supabase
        .from("organizations")
        .select("notification_config, slack_webhook_url")
        .eq("id", orgId)
        .maybeSingle();
      const merged = { ...DEFAULT, ...((data?.notification_config as any) || {}) };
      merged.categories = { ...DEFAULT.categories, ...((data?.notification_config as any)?.categories || {}) };
      setCfg(merged);
      setSlackUrl((data as any)?.slack_webhook_url || "");
      setLoading(false);
    })();
  }, [orgId]);

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ notification_config: cfg as any, slack_webhook_url: slackUrl.trim() || null } as any)
      .eq("id", orgId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Notification settings saved");
  };

  if (!orgId) return null;
  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading notification settings…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" /> Organization notification delivery
        </CardTitle>
        <CardDescription>
          Applies to every workspace and project in <strong>{currentOrganization?.name}</strong>. Events fire in-app always;
          use these switches to also route them to email and Slack.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4" /> Email delivery</span>
            <Switch
              checked={cfg.email}
              disabled={!canManage}
              onCheckedChange={(v) => setCfg({ ...cfg, email: v })}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm"><Slack className="h-4 w-4" /> Slack delivery</span>
            <Switch
              checked={cfg.slack}
              disabled={!canManage}
              onCheckedChange={(v) => setCfg({ ...cfg, slack: v })}
            />
          </label>
        </div>

        <div className="space-y-2">
          <Label>Organization Slack incoming-webhook URL</Label>
          <Input
            value={slackUrl}
            disabled={!canManage}
            onChange={(e) => setSlackUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
          />
          <p className="text-xs text-muted-foreground">
            Every project's notifications flow to this webhook. Individual users may still override with a personal webhook
            in their Settings.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" /> Global event categories
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <label key={c.key} className="flex items-center justify-between rounded-md border p-3">
                <span className="text-sm">{c.label}</span>
                <Switch
                  checked={cfg.categories?.[c.key] !== false}
                  disabled={!canManage}
                  onCheckedChange={(v) => setCfg({ ...cfg, categories: { ...cfg.categories, [c.key]: v } })}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !canManage}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save notification settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
