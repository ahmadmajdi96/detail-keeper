import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Mail, MessageSquare, Loader2 } from "lucide-react";

const CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: "defect_assigned", label: "Defect assigned to me", hint: "You get pinged when a defect lands in your queue." },
  { key: "defect_created", label: "New defect in my projects", hint: "New defects reported anywhere you manage." },
  { key: "run_finished", label: "Test runs finished", hint: "Suite / cycle runs completing." },
  { key: "gate_blocked", label: "Quality gate blocked", hint: "A release was held by a gate." },
  { key: "release_verdict", label: "AI release verdict", hint: "The release judge issued a recommendation." },
  { key: "testplan_generated", label: "Test plan generated", hint: "AI finished producing a plan." },
];

const DEFAULT_PREFS = {
  email: true,
  slack: false,
  in_app: true,
  categories: Object.fromEntries(CATEGORIES.map((c) => [c.key, true])) as Record<string, boolean>,
};

export function NotificationPrefsPanel() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<typeof DEFAULT_PREFS>(DEFAULT_PREFS);
  const [slackUrl, setSlackUrl] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("notification_prefs, slack_webhook_url").eq("id", user.id).maybeSingle();
      const merged = { ...DEFAULT_PREFS, ...(data?.notification_prefs || {}) } as typeof DEFAULT_PREFS;
      merged.categories = { ...DEFAULT_PREFS.categories, ...((data?.notification_prefs as any)?.categories || {}) };
      setPrefs(merged);
      setSlackUrl(data?.slack_webhook_url ?? "");
      setLoading(false);
    })();
  }, [user?.id]);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      notification_prefs: prefs,
      slack_webhook_url: slackUrl.trim() || null,
    } as any).eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Notification preferences saved");
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Notifications</CardTitle>
        <CardDescription>Choose where each type of notification is delivered. In-app is always on.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm"><Bell className="h-4 w-4" /> In-app</span>
            <Switch checked disabled />
          </label>
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4" /> Email</span>
            <Switch checked={prefs.email} onCheckedChange={(v) => setPrefs({ ...prefs, email: v })} />
          </label>
          <label className="flex items-center justify-between rounded-lg border p-3">
            <span className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4" /> Slack</span>
            <Switch checked={prefs.slack} onCheckedChange={(v) => setPrefs({ ...prefs, slack: v })} />
          </label>
        </div>

        <div className="space-y-2">
          <Label>Personal Slack incoming-webhook URL (optional)</Label>
          <Input value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} placeholder="https://hooks.slack.com/services/…" />
          <p className="text-xs text-muted-foreground">
            If empty, we'll fall back to the workspace's Slack webhook (configured by an admin). Leave both empty to skip Slack.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">Categories</div>
          <div className="space-y-2">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.hint}</div>
                </div>
                <Switch
                  checked={prefs.categories?.[c.key] !== false}
                  onCheckedChange={(v) => setPrefs({ ...prefs, categories: { ...prefs.categories, [c.key]: v } })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
