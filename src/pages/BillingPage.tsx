import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEntitlements, useOrgUsage } from "@/hooks/useEntitlements";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, CreditCard, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { getPaddleEnvironment } from "@/lib/paddle";

function ModeBadge() {
  const isTest = getPaddleEnvironment() === "sandbox";
  return (
    <Badge variant="outline" className={isTest ? "border-amber-500/60 text-amber-500" : "border-emerald-500/60 text-emerald-500"}>
      {isTest ? "Payments: Test mode" : "Payments: Live"}
    </Badge>
  );
}


const FEATURE_ROWS: Array<{ key: string; label: string }> = [
  { key: "sso", label: "SSO / SAML" },
  { key: "audit_log", label: "Audit log" },
  { key: "api_keys", label: "API keys" },
  { key: "priority_support", label: "Priority support" },
];

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit == null;
  const pct = unlimited ? 0 : Math.min(100, (used / Math.max(1, limit)) * 100);
  const color = pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-accent";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{used} / {unlimited ? "∞" : limit}</span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: unlimited ? "6%" : `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { currentOrganization, currentOrgRole } = useOrganization();
  const { entitlements, subscription, loading, refresh } = useEntitlements();
  const usage = useOrgUsage();
  const qc = useQueryClient();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [billingConfigured, setBillingConfigured] = useState<boolean | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").eq("is_active", true).order("monthly_price_cents");
      if (error) throw error;
      return data || [];
    },
  });

  const canManage = currentOrgRole === "owner" || currentOrgRole === "billing_admin";

  // Handle Stripe return
  useEffect(() => {
    if (searchParams.get("success") === "1") {
      toast.success("Subscription updated — refreshing…");
      refresh();
      qc.invalidateQueries({ queryKey: ["entitlements"] });
      searchParams.delete("success"); setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get("canceled") === "1") {
      toast.info("Checkout canceled");
      searchParams.delete("canceled"); setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upgrade(planKey: string) {
    if (!canManage) return toast.error("Only org owner/billing admin can upgrade");
    setBusy(planKey);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { plan_key: planKey, interval, origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.error === "billing_not_configured") {
        setBillingConfigured(false);
        toast.error("Billing isn't configured yet. An admin must add Stripe keys.");
        return;
      }
      if (data?.error === "price_not_configured") {
        toast.error(`Admin: set ${data.missing} secret to enable this price.`);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data?.error || "Unknown error");
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const { data, error } = await supabase.functions.invoke("create-billing-portal", {
        body: { origin: window.location.origin },
      });
      if (error) throw error;
      if (data?.error === "billing_not_configured") {
        setBillingConfigured(false);
        toast.error("Billing isn't configured yet.");
        return;
      }
      if (data?.url) { window.location.href = data.url; return; }
      throw new Error(data?.error || "Unknown error");
    } catch (e: any) {
      toast.error(e.message || "Could not open billing portal");
    } finally {
      setBusy(null);
    }
  }

  if (loading || !currentOrganization) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  const currentKey = subscription?.plan_key || "free";
  const hasPaidSub = !!subscription?.stripe_subscription_id;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mt-2">
        <PageHeader title="Billing & Plan" description="Manage your organization's plan, usage, and limits." />
        <StripeModeBadge onConfigured={setBillingConfigured} />
      </div>

      {billingConfigured === false && (
        <Alert className="mt-4 border-amber-500/40">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Billing isn't configured yet</AlertTitle>
          <AlertDescription>
            An admin needs to add <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code>, and the price ID secrets
            (<code>STRIPE_PRICE_PRO_MONTHLY</code>, <code>STRIPE_PRICE_PRO_YEARLY</code>,{" "}
            <code>STRIPE_PRICE_ENTERPRISE_MONTHLY</code>, <code>STRIPE_PRICE_ENTERPRISE_YEARLY</code>) in Project Settings → Secrets.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Current plan */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current plan</CardTitle>
              <Badge variant={subscription?.status === "past_due" ? "destructive" : "default"}>
                {subscription?.status || "active"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-semibold capitalize">{currentKey}</div>
            {subscription?.current_period_end && (
              <div className="text-sm text-muted-foreground">
                Renews {format(new Date(subscription.current_period_end), "PP")}
              </div>
            )}
            {subscription?.trial_ends_at && (
              <div className="text-sm">Trial ends {format(new Date(subscription.trial_ends_at), "PP")}</div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {subscription?.stripe_customer_id ? "Card on file" : "No payment method"}
              </span>
            </div>
            {hasPaidSub && canManage && (
              <Button size="sm" variant="outline" onClick={openPortal} disabled={busy === "portal"}>
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Usage */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Usage — this period</CardTitle>
            <CardDescription>Resets at the end of your billing period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar label="Seats" used={usage.data?.seats ?? 0} limit={entitlements.seats} />
            <UsageBar label="Workspaces" used={usage.data?.workspaces ?? 0} limit={entitlements.max_workspaces} />
            <UsageBar label="Projects" used={usage.data?.projects ?? 0} limit={entitlements.max_projects} />
            <UsageBar label="AI jobs" used={usage.data?.ai_jobs ?? 0} limit={entitlements.ai_jobs_per_month} />
            <UsageBar label="Runner minutes" used={usage.data?.runner_minutes ?? 0} limit={entitlements.runner_minutes_per_month} />
          </CardContent>
        </Card>
      </div>

      {/* Plans */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Plans</h2>
          <Tabs value={interval} onValueChange={(v) => setInterval(v as "monthly" | "yearly")}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly <span className="ml-1.5 text-[10px] text-emerald-500">-20%</span></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {(plansQ.data || []).map((p: any) => {
            const isCurrent = p.key === currentKey;
            const ent = p.entitlements || {};
            const cents = interval === "yearly" ? p.yearly_price_cents : p.monthly_price_cents;
            const perLabel = interval === "yearly" ? "/yr" : "/mo";
            const isFree = p.key === "free";
            return (
              <Card key={p.key} className={isCurrent ? "border-accent" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    {isCurrent && <Badge variant="outline">Current</Badge>}
                  </div>
                  <div className="text-3xl font-bold">
                    ${(cents / 100).toFixed(0)}
                    <span className="text-sm font-normal text-muted-foreground">{perLabel}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="text-sm space-y-1.5">
                    <li>Seats: <strong>{ent.seats ?? "Unlimited"}</strong></li>
                    <li>Workspaces: <strong>{ent.max_workspaces ?? "Unlimited"}</strong></li>
                    <li>Projects: <strong>{ent.max_projects ?? "Unlimited"}</strong></li>
                    <li>AI jobs/mo: <strong>{ent.ai_jobs_per_month ?? "Unlimited"}</strong></li>
                    <li>Runner min/mo: <strong>{ent.runner_minutes_per_month ?? "Unlimited"}</strong></li>
                  </ul>
                  <div className="border-t pt-2 space-y-1">
                    {FEATURE_ROWS.map((f) => (
                      <div key={f.key} className="flex items-center gap-2 text-sm">
                        {ent[f.key] ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-muted-foreground/60" />}
                        <span>{f.label}</span>
                      </div>
                    ))}
                  </div>
                  {isCurrent ? (
                    hasPaidSub && canManage ? (
                      <Button className="w-full" variant="outline" onClick={openPortal} disabled={busy === "portal"}>
                        {busy === "portal" ? "Opening…" : "Manage"}
                      </Button>
                    ) : (
                      <Button className="w-full" variant="outline" disabled>Current plan</Button>
                    )
                  ) : isFree ? (
                    <Button className="w-full" variant="outline" disabled>Downgrade via billing portal</Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => upgrade(p.key)}
                      disabled={!canManage || busy === p.key}
                    >
                      {busy === p.key ? "Redirecting…" : `Upgrade to ${p.name}`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
