import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, RefreshCw, Plug, PlugZap, Loader2, ExternalLink, Trash2, GitBranch, Bug, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectScope } from "@/hooks/useProjectScope";
import { useIntegrationStatus } from "@/hooks/useIntegrationStatus";
import { connectOAuthPopup } from "@/lib/oauth-popup";
import { useWorkspace } from "@/contexts/WorkspaceContext";

type ActivityRow = {
  id: string;
  provider: string;
  kind: string;
  status: "ok" | "error" | string;
  message: string | null;
  counts: Record<string, number> | null;
  occurred_at: string;
};

export default function IntegrationSettingsPage() {
  const { workspaceId, projectId } = useProjectScope();
  const { currentWorkspace } = useWorkspace();
  const { byProvider } = useIntegrationStatus(workspaceId);
  const github = byProvider["github"];
  const jira = byProvider["jira"];

  const [callbacks, setCallbacks] = useState<{ github: string; jira: string } | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [jiraMappings, setJiraMappings] = useState<any[]>([]);
  const [ghMappings, setGhMappings] = useState<any[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [syncingGh, setSyncingGh] = useState(false);
  const [syncingJira, setSyncingJira] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  // Load callback URLs (once)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.functions.invoke("integrations-callback-info", { body: {} });
      if (data) setCallbacks(data);
    })();
  }, []);

  // Load projects + mappings + activity for workspace
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      const [p, jm, gm, log] = await Promise.all([
        supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).order("name"),
        supabase.from("jira_project_mappings").select("*").eq("workspace_id", workspaceId),
        supabase.from("github_repo_mappings").select("*").eq("workspace_id", workspaceId),
        supabase.from("integration_activity_log").select("*").eq("workspace_id", workspaceId).order("occurred_at", { ascending: false }).limit(50),
      ]);
      if (cancelled) return;
      setProjects(p.data ?? []);
      setJiraMappings(jm.data ?? []);
      setGhMappings(gm.data ?? []);
      setActivity((log.data ?? []) as ActivityRow[]);
    })();

    const ch = supabase
      .channel(`activity-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "integration_activity_log", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => setActivity((prev) => [payload.new as ActivityRow, ...prev].slice(0, 50)),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [workspaceId]);

  const jiraSites = useMemo(() => {
    const cfg = (jira as any)?.config ?? null;
    // status hook doesn't include config; we fetch it directly
    return cfg?.sites ?? [];
  }, [jira]);

  const [jiraConfig, setJiraConfig] = useState<any>(null);
  useEffect(() => {
    if (!workspaceId || !jira?.slug) return;
    (async () => {
      const { data } = await supabase
        .from("integration_connections")
        .select("config")
        .eq("workspace_id", workspaceId)
        .eq("slug", "jira")
        .maybeSingle();
      setJiraConfig(data?.config ?? null);
    })();
  }, [workspaceId, jira?.slug, jira?.status]);

  const sites: Array<{ id: string; url: string; name: string }> = jiraConfig?.sites ?? [];

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  }

  async function handleConnect(provider: "github" | "jira") {
    if (!workspaceId) return toast.error("Select a workspace");
    setBusyProvider(provider);
    try {
      const res = await connectOAuthPopup({ provider, workspace_id: workspaceId, project_id: projectId });
      if (res.ok) toast.success(`${provider} connected${res.message ? ` — ${res.message}` : ""}`);
      else toast.error(`${provider} not connected: ${res.message ?? "failed"}`);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.startsWith("POPUP_BLOCKED:")) toast.error(msg.replace("POPUP_BLOCKED:", ""));
      else toast.error(msg);
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleDisconnect(provider: "github" | "jira") {
    if (!workspaceId) return;
    setBusyProvider(provider);
    const { data, error } = await supabase.functions.invoke("integrations-disconnect", {
      body: { provider, workspace_id: workspaceId },
    });
    setBusyProvider(null);
    if (error || (data as any)?.error) toast.error(error?.message ?? (data as any).error);
    else toast.success(`${provider} disconnected`);
  }

  async function handleReconnect(provider: "github" | "jira") {
    await handleDisconnect(provider);
    setTimeout(() => handleConnect(provider), 250);
  }

  async function handleToggleSync(provider: "github" | "jira", enabled: boolean) {
    if (!workspaceId) return;
    await supabase
      .from("integration_connections")
      .update({ sync_enabled: enabled })
      .eq("workspace_id", workspaceId)
      .eq("slug", provider);
    toast.success(`Sync ${enabled ? "enabled" : "paused"} for ${provider}`);
  }

  async function runSync(provider: "github" | "jira") {
    if (!workspaceId) return toast.error("Select a workspace");
    const setter = provider === "github" ? setSyncingGh : setSyncingJira;
    setter(true);
    const { data, error } = await supabase.functions.invoke(`${provider}-sync`, {
      body: { workspace_id: workspaceId, project_id: projectId },
    });
    setter(false);
    if (error || (data as any)?.error) toast.error(error?.message ?? (data as any).error);
    else {
      const counts = provider === "github" ? `${(data as any).builds ?? 0} builds` : `${(data as any).issues ?? 0} issues, ${(data as any).linked ?? 0} linked`;
      toast.success(`${provider} sync complete — ${counts}`);
    }
  }

  // Mapping editors
  async function addJiraMapping(form: { project_id: string; jira_cloud_id: string; jira_project_key: string; rule_match: string; rule_labels: string }) {
    if (!workspaceId) return;
    const site = sites.find((s) => s.id === form.jira_cloud_id);
    const labels = form.rule_labels.split(",").map((x) => x.trim()).filter(Boolean);
    const { error } = await supabase.from("jira_project_mappings").insert({
      workspace_id: workspaceId,
      project_id: form.project_id,
      jira_cloud_id: form.jira_cloud_id,
      jira_site_url: site?.url ?? null,
      jira_project_key: form.jira_project_key.toUpperCase().trim(),
      auto_link_rule: { match: form.rule_match, labels },
    });
    if (error) return toast.error(error.message);
    toast.success("Jira mapping added");
    const { data } = await supabase.from("jira_project_mappings").select("*").eq("workspace_id", workspaceId);
    setJiraMappings(data ?? []);
  }
  async function deleteJiraMapping(id: string) {
    await supabase.from("jira_project_mappings").delete().eq("id", id);
    setJiraMappings((p) => p.filter((m) => m.id !== id));
  }
  async function addGhMapping(form: { project_id: string; owner: string; repo: string; default_branch: string; test_plan_id?: string }) {
    if (!workspaceId) return;
    const { error } = await supabase.from("github_repo_mappings").insert({
      workspace_id: workspaceId,
      project_id: form.project_id,
      owner: form.owner.trim(),
      repo: form.repo.trim(),
      default_branch: form.default_branch || "main",
      test_plan_id: form.test_plan_id || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Repo mapping added");
    const { data } = await supabase.from("github_repo_mappings").select("*").eq("workspace_id", workspaceId);
    setGhMappings(data ?? []);
  }
  async function deleteGhMapping(id: string) {
    await supabase.from("github_repo_mappings").delete().eq("id", id);
    setGhMappings((p) => p.filter((m) => m.id !== id));
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Integration Settings"
          description={`Manage GitHub & Jira credentials, mappings, and sync for ${currentWorkspace?.name ?? "this workspace"}.`}
        />

        <Tabs defaultValue="connections">
          <TabsList>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="mappings">Project Mapping</TabsTrigger>
            <TabsTrigger value="activity">Sync &amp; Activity</TabsTrigger>
          </TabsList>

          {/* CONNECTIONS */}
          <TabsContent value="connections" className="space-y-4">
            {/* GitHub */}
            <ProviderCard
              provider="github"
              title="GitHub"
              description="Reads workflow runs into Builds and Test Plans."
              status={github}
              busy={busyProvider === "github"}
              callbackUrl={callbacks?.github}
              onConnect={() => handleConnect("github")}
              onDisconnect={() => handleDisconnect("github")}
              onReconnect={() => handleReconnect("github")}
              onToggleSync={(v) => handleToggleSync("github", v)}
              onCopy={copy}
            />
            {/* Jira */}
            <ProviderCard
              provider="jira"
              title="Jira (Atlassian Cloud)"
              description="Pulls issues for defect auto-linking and traceability."
              status={jira}
              busy={busyProvider === "jira"}
              callbackUrl={callbacks?.jira}
              onConnect={() => handleConnect("jira")}
              onDisconnect={() => handleDisconnect("jira")}
              onReconnect={() => handleReconnect("jira")}
              onToggleSync={(v) => handleToggleSync("jira", v)}
              onCopy={copy}
              extra={sites.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Linked sites: {sites.map((s) => s.name).join(", ")}
                </p>
              )}
            />
          </TabsContent>

          {/* MAPPINGS */}
          <TabsContent value="mappings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bug className="h-4 w-4" /> Jira project mappings</CardTitle>
                <CardDescription>
                  Map each Qualixa project to a Jira project key. Defects matching the rule
                  will be auto-linked on the next Jira sync.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <JiraMappingForm projects={projects} sites={sites} onAdd={addJiraMapping} />
                <div className="rounded border border-border/40">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Qualixa project</TableHead>
                        <TableHead>Jira site</TableHead>
                        <TableHead>Jira project key</TableHead>
                        <TableHead>Auto-link rule</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jiraMappings.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No Jira mappings yet.</TableCell></TableRow>
                      )}
                      {jiraMappings.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{projects.find((p) => p.id === m.project_id)?.name ?? "—"}</TableCell>
                          <TableCell className="text-xs">{m.jira_site_url ?? m.jira_cloud_id}</TableCell>
                          <TableCell><Badge variant="outline">{m.jira_project_key}</Badge></TableCell>
                          <TableCell className="text-xs">
                            <span className="font-mono">{m.auto_link_rule?.match}</span>
                            {Array.isArray(m.auto_link_rule?.labels) && m.auto_link_rule.labels.length > 0 && (
                              <> · labels: {m.auto_link_rule.labels.join(", ")}</>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => deleteJiraMapping(m.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> GitHub repo mappings</CardTitle>
                <CardDescription>
                  Map each Qualixa project to a GitHub repo. Workflow runs become Builds and
                  can optionally bind to a Test Plan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <GhMappingForm projects={projects} onAdd={addGhMapping} />
                <div className="rounded border border-border/40">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Qualixa project</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Repo</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ghMappings.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No GitHub mappings yet.</TableCell></TableRow>
                      )}
                      {ghMappings.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>{projects.find((p) => p.id === m.project_id)?.name ?? "—"}</TableCell>
                          <TableCell>{m.owner}</TableCell>
                          <TableCell>{m.repo}</TableCell>
                          <TableCell><Badge variant="outline">{m.default_branch}</Badge></TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => deleteGhMapping(m.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ACTIVITY */}
          <TabsContent value="activity" className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={() => runSync("github")} disabled={syncingGh}>
                {syncingGh ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync GitHub now
              </Button>
              <Button onClick={() => runSync("jira")} disabled={syncingJira} variant="outline">
                {syncingJira ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Sync Jira now
              </Button>
              <div className="flex-1" />
              <Button asChild variant="ghost">
                <Link to="/integrations">Back to Integrations</Link>
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Last 50 OAuth attempts, syncs, and lifecycle events.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">When</TableHead>
                      <TableHead className="w-24">Provider</TableHead>
                      <TableHead className="w-32">Kind</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="w-48">Counts</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No activity yet.</TableCell></TableRow>
                    )}
                    {activity.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(row.occurred_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{row.provider}</Badge></TableCell>
                        <TableCell className="text-xs">{row.kind}</TableCell>
                        <TableCell>
                          {row.status === "ok" ? (
                            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">ok</Badge>
                          ) : (
                            <Badge className="bg-red-500/15 text-red-300 border-red-500/30">error</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{row.message}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {row.counts ? Object.entries(row.counts).map(([k, v]) => `${k}:${v}`).join(" ") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/* ============ sub-components ============ */

function ProviderCard(props: {
  provider: "github" | "jira";
  title: string;
  description: string;
  status: any;
  busy: boolean;
  callbackUrl: string | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  onToggleSync: (v: boolean) => void;
  onCopy: (text: string) => void;
  extra?: React.ReactNode;
}) {
  const connected = props.status?.status === "active";
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              {props.title}
              {connected ? (
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Connected
                </Badge>
              ) : props.status?.status === "error" ? (
                <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 gap-1">
                  <AlertTriangle className="h-3 w-3" /> Error
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3" /> Not connected
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{props.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Sync</span>
                  <Switch checked={!!props.status?.sync_enabled} onCheckedChange={props.onToggleSync} />
                </div>
                <Button variant="outline" size="sm" onClick={props.onReconnect} disabled={props.busy}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Reconnect
                </Button>
                <Button variant="ghost" size="sm" onClick={props.onDisconnect} disabled={props.busy} className="text-destructive">
                  Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={props.onConnect} disabled={props.busy}>
                {props.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                Connect
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.status?.last_sync_at && (
          <p className="text-xs text-muted-foreground">Last sync: {new Date(props.status.last_sync_at).toLocaleString()}</p>
        )}
        {props.status?.last_error && (
          <div className="rounded border border-amber-500/30 bg-amber-500/5 text-xs px-3 py-2 text-amber-300">
            Last error: {props.status.last_error}
          </div>
        )}
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">OAuth callback URL</Label>
          <div className="flex gap-2 mt-1">
            <Input readOnly value={props.callbackUrl ?? "loading…"} className="font-mono text-xs" />
            <Button size="icon" variant="outline" onClick={() => props.callbackUrl && props.onCopy(props.callbackUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Paste this into your {props.provider === "github" ? "GitHub OAuth App's Authorization callback URL" : "Atlassian OAuth 2.0 (3LO) app Callback URL"} field.
          </p>
        </div>
        {props.extra}
      </CardContent>
    </Card>
  );
}

function JiraMappingForm({
  projects,
  sites,
  onAdd,
}: {
  projects: Array<{ id: string; name: string }>;
  sites: Array<{ id: string; url: string; name: string }>;
  onAdd: (f: any) => Promise<void>;
}) {
  const [form, setForm] = useState({ project_id: "", jira_cloud_id: "", jira_project_key: "", rule_match: "summary", rule_labels: "" });
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
      <div className="md:col-span-2">
        <Label className="text-xs">Project</Label>
        <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2">
        <Label className="text-xs">Jira site</Label>
        <Select value={form.jira_cloud_id} onValueChange={(v) => setForm({ ...form, jira_cloud_id: v })}>
          <SelectTrigger><SelectValue placeholder={sites.length ? "Select site" : "Connect Jira first"} /></SelectTrigger>
          <SelectContent>
            {sites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Project key</Label>
        <Input placeholder="QA" value={form.jira_project_key} onChange={(e) => setForm({ ...form, jira_project_key: e.target.value })} />
      </div>
      <div>
        <Label className="text-xs">Match</Label>
        <Select value={form.rule_match} onValueChange={(v) => setForm({ ...form, rule_match: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="summary">Summary</SelectItem>
            <SelectItem value="labels">Labels</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-5">
        <Label className="text-xs">Labels (comma-separated, optional)</Label>
        <Input placeholder="bug, qa" value={form.rule_labels} onChange={(e) => setForm({ ...form, rule_labels: e.target.value })} />
      </div>
      <Button
        onClick={async () => {
          if (!form.project_id || !form.jira_cloud_id || !form.jira_project_key) return toast.error("Project, site and key required");
          await onAdd(form);
          setForm({ project_id: "", jira_cloud_id: "", jira_project_key: "", rule_match: "summary", rule_labels: "" });
        }}
      >
        <Plug className="mr-2 h-4 w-4" /> Add
      </Button>
    </div>
  );
}

function GhMappingForm({
  projects,
  onAdd,
}: {
  projects: Array<{ id: string; name: string }>;
  onAdd: (f: any) => Promise<void>;
}) {
  const [form, setForm] = useState({ project_id: "", owner: "", repo: "", default_branch: "main", test_plan_id: "" });
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
      <div>
        <Label className="text-xs">Project</Label>
        <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
          <SelectContent>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label className="text-xs">Owner</Label><Input placeholder="acme" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div>
      <div><Label className="text-xs">Repo</Label><Input placeholder="webapp" value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })} /></div>
      <div><Label className="text-xs">Branch</Label><Input value={form.default_branch} onChange={(e) => setForm({ ...form, default_branch: e.target.value })} /></div>
      <Button
        onClick={async () => {
          if (!form.project_id || !form.owner || !form.repo) return toast.error("Project, owner and repo required");
          await onAdd(form);
          setForm({ project_id: "", owner: "", repo: "", default_branch: "main", test_plan_id: "" });
        }}
      >
        <Plug className="mr-2 h-4 w-4" /> Add
      </Button>
    </div>
  );
}
