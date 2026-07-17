import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trash2, Plus, ShieldCheck, Info, Lock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  orgId: string;
  canManage: boolean;
  ssoEnabled: boolean;
}

type ProviderKind = "saml" | "oidc";

export function OrgSsoPanel({ orgId, canManage, ssoEnabled }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState<ProviderKind>("saml");
  const [displayName, setDisplayName] = useState("");
  const [domains, setDomains] = useState("");
  const [metadataUrl, setMetadataUrl] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [certificate, setCertificate] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [enabled, setEnabled] = useState(true);

  const listQ = useQuery({
    queryKey: ["sso-connections", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sso_connections").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const resetForm = () => {
    setDisplayName(""); setDomains(""); setMetadataUrl(""); setSsoUrl("");
    setCertificate(""); setIssuer(""); setClientId(""); setClientSecret("");
    setProvider("saml"); setEnabled(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const domainList = domains.split(/[\s,]+/).map((d) => d.trim().toLowerCase()).filter(Boolean);
      if (!domainList.length) throw new Error("At least one email domain is required");
      const config = provider === "saml"
        ? { metadata_url: metadataUrl || null, sso_url: ssoUrl || null, certificate: certificate || null }
        : { issuer, client_id: clientId, client_secret: clientSecret };
      const { error } = await supabase.from("sso_connections").insert({
        org_id: orgId, provider, display_name: displayName || null,
        domains: domainList, config, enabled,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SSO connection saved");
      resetForm(); setShowForm(false);
      qc.invalidateQueries({ queryKey: ["sso-connections", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("sso_connections").update({ enabled: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sso-connections", orgId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sso_connections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Connection removed");
      qc.invalidateQueries({ queryKey: ["sso-connections", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!ssoEnabled) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Single Sign-On</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            SAML and OIDC SSO are available on the <span className="font-medium text-foreground">Enterprise</span> plan.
            Route your workforce to Qualixa through your existing identity provider (Okta, Azure AD, Google Workspace, Auth0…).
          </p>
          <Button asChild><a href="/billing">Upgrade to Enterprise</a></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Platform prerequisite</AlertTitle>
        <AlertDescription>
          Registering the connection here saves your organization&apos;s IdP settings and links your email domains.
          For SAML sign-in to actually reach your IdP, an admin must also add the IdP to the auth platform (Supabase Auth → SSO).
          Store the resulting <code className="text-xs">provider_id</code> in the connection&apos;s config to complete the wiring.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Identity providers</CardTitle>
          {canManage && (
            <Button size="sm" variant={showForm ? "outline" : "default"} onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-1" /> {showForm ? "Cancel" : "Add connection"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && canManage && (
            <div className="space-y-3 rounded-lg border border-border/50 p-4 bg-muted/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Protocol</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as ProviderKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saml">SAML 2.0</SelectItem>
                      <SelectItem value="oidc">OpenID Connect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Display name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Okta Corp SSO" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email domains</Label>
                <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="acme.com, subsidiary.acme.com" />
                <p className="text-xs text-muted-foreground">Users signing in with these domains will be routed to this IdP.</p>
              </div>

              {provider === "saml" ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>IdP metadata URL</Label>
                    <Input value={metadataUrl} onChange={(e) => setMetadataUrl(e.target.value)} placeholder="https://idp.example.com/app/exk.../sso/saml/metadata" />
                  </div>
                  <div className="text-xs text-muted-foreground">…or provide the SSO URL + certificate manually:</div>
                  <div className="space-y-1.5">
                    <Label>SSO URL</Label>
                    <Input value={ssoUrl} onChange={(e) => setSsoUrl(e.target.value)} placeholder="https://idp.example.com/app/exk.../sso/saml" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>X.509 certificate</Label>
                    <Textarea value={certificate} onChange={(e) => setCertificate(e.target.value)} rows={4} placeholder="-----BEGIN CERTIFICATE-----&#10;..." />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Issuer URL</Label>
                    <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="https://idp.example.com" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Client ID</Label>
                      <Input value={clientId} onChange={(e) => setClientId(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Client secret</Label>
                      <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                  <span className="text-sm">Enable immediately</span>
                </div>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending ? "Saving…" : "Save connection"}
                </Button>
              </div>
            </div>
          )}

          {(listQ.data || []).map((c: any) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/50 p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.display_name || c.provider.toUpperCase()}</span>
                  <Badge variant="outline">{c.provider.toUpperCase()}</Badge>
                  <Badge variant={c.enabled ? "default" : "secondary"}>{c.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Domains: {(c.domains || []).join(", ") || "—"}
                </div>
                {c.supabase_provider_id ? (
                  <div className="text-xs text-muted-foreground">Platform provider ID: <code>{c.supabase_provider_id}</code></div>
                ) : (
                  <div className="text-xs text-amber-500">Awaiting platform registration to complete sign-in flow.</div>
                )}
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Switch checked={c.enabled} onCheckedChange={(v) => toggleEnabled.mutate({ id: c.id, value: v })} />
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {!listQ.isLoading && (listQ.data || []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No SSO connections yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
