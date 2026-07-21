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

const FEATURE_ROWS: Array<{ key: string; label: string }> = [
  { key: "sso", label: "SSO / SAML" },
  { key: "audit_log", label: "Audit log" },
  { key: "api_keys", label: "API keys" },
  { key: "priority_support", label: "Priority support" },
];

// Maps our plan_key → Paddle price_id (external_id) — only paid plans
const PRICE_BY_PLAN: Record<string, string> = {
  individual_starter: "individual_starter_monthly",
  individual_pro: "individual_pro_monthly",
  individual_grow: "individual_grow_monthly",
  enterprise_small: "enterprise_small_monthly",
  enterprise_mid: "enterprise_mid_monthly",
};

function ModeBadge() {
  const isTest = getPaddleEnvironment() === "sandbox";
  return (
    <Badge variant="outline" className={isTest ? "border-amber-500/60 text-amber-500" : "border-emerald-500/60 text-emerald-500"}>
      {isTest ? "Payments: Test mode" : "Payments: Live"}
    </Badge>
  );
}

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
  const { user } = useAuth();
  const { entitlements, subscription, loading, refresh } = useEntitlements();
  const usage = useOrgUsage();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();

  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").eq("is_active", true).order("monthly_price_cents");
      if (error) throw error;
      return (data || []).filter((p: any) => p.key === "free" || PRICE_BY_PLAN[p.key]);
    },
  });

  const canManage = currentOrgRole === "owner" || currentOrgRole === "billing_admin";

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      toast.success("Subscription updated — refreshing…");
      refresh();
      qc.invalidateQueries({ queryKey: ["entitlements"] });
      searchParams.delete("success"); setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upgrade(planKey: string) {
    if (!canManage) return toast.error("Only org owner/billing admin can change plans");
    if (!user?.id) return toast.error("Please sign in");
    const priceId = PRICE_BY_PLAN[planKey];
    if (!priceId) return toast.error("This plan is not available for checkout");
    setBusy(planKey);
    try {
      await openCheckout({
        priceId,
        userId: user.id,
        customerEmail: user.email ?? undefined,
        successUrl: `${window.location.origin}/billing?success=1`,
      });
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    try {
      const { data, error } = await supabase.functions.invoke("paddle-portal", { body: {} });
      if (error) throw error;
      if (data?.error === "no_paid_subscription") {
        toast.info("You don't have a paid subscription yet.");
        return;
      }
      if (data?.url) { window.open(data.url, "_blank"); return; }
      throw new Error(data?.error || "Could not open billing portal");
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

  const sub: any = subscription;
  const currentKey = sub?.plan_key || "free";
  const hasPaidSub = !!sub?.paddle_subscription_id;

  return (
    <AppLayout>
      <div className="flex items-center justify-between mt-2">
        <PageHeader title="Billing & Plan" description="Manage your organization's plan, usage, and limits." />
        <ModeBadge />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current plan</CardTitle>
              <Badge variant={sub?.status === "past_due" ? "destructive" : "default"}>
                {sub?.status || "active"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-semibold">
              {plansQ.data?.find((p: any) => p.key === currentKey)?.name || currentKey}
            </div>
            {sub?.current_period_end && (
              <div className="text-sm text-muted-foreground">
                Renews {format(new Date(sub.current_period_end), "PP")}
              </div>
            )}
            {sub?.trial_ends_at && !hasPaidSub && (
              <div className="text-sm">Trial ends {format(new Date(sub.trial_ends_at), "PP")}</div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {sub?.paddle_customer_id ? "Card on file" : "No payment method"}
              </span>
            </div>
            {hasPaidSub && canManage && (
              <Button size="sm" variant="outline" onClick={openPortal} disabled={busy === "portal"}>
                {busy === "portal" ? "Opening…" : "Manage billing"}
              </Button>
            )}
          </CardContent>
        </Card>

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

      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Plans</h2>
          <div className="text-xs text-muted-foreground">Prorated on upgrade/downgrade. Cancel anytime.</div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(plansQ.data || []).map((p: any) => {
            const isCurrent = p.key === currentKey;
            const ent = p.entitlements || {};
            const cents = p.monthly_price_cents;
            const isFree = p.key === "free";
            return (
              <Card key={p.key} className={isCurrent ? "border-accent shadow-lg shadow-accent/10" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{p.name}</CardTitle>
                    {isCurrent && <Badge variant="outline">Current</Badge>}
                  </div>
                  <div className="text-3xl font-bold">
                    ${(cents / 100).toFixed(0)}
                    <span className="text-sm font-normal text-muted-foreground">{isFree ? "" : "/mo"}</span>
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
                    hasPaidSub && canManage ? (
                      <Button className="w-full" variant="outline" onClick={openPortal} disabled={busy === "portal"}>
                        Downgrade
                      </Button>
                    ) : (
                      <Button className="w-full" variant="outline" disabled>Free plan</Button>
                    )
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => upgrade(p.key)}
                      disabled={!canManage || busy === p.key || checkoutLoading}
                    >
                      {busy === p.key ? "Opening checkout…" : hasPaidSub ? `Switch to ${p.name}` : `Subscribe to ${p.name}`}
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
