import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useEntitlements, useOrgUsage } from "@/hooks/useEntitlements";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, CreditCard, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
        <span className="font-mono">
          {used} / {unlimited ? "∞" : limit}
        </span>
      </div>
      <div className="h-2 rounded bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: unlimited ? "6%" : `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BillingPage() {
  const { currentOrganization, currentOrgRole } = useOrganization();
  const { entitlements, subscription, loading } = useEntitlements();
  const usage = useOrgUsage();

  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").eq("is_active", true).order("monthly_price_cents");
      if (error) throw error;
      return data || [];
    },
  });

  const canManage = currentOrgRole === "owner" || currentOrgRole === "billing_admin";

  if (loading || !currentOrganization) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  const currentKey = subscription?.plan_key || "free";

  return (
    <AppLayout>
      <PageHeader title="Billing & Plan" description="Manage your organization's plan, usage, and limits." />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Current plan */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current plan</CardTitle>
              <Badge>{subscription?.status || "active"}</Badge>
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

      {/* Plan cards */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(plansQ.data || []).map((p: any) => {
            const isCurrent = p.key === currentKey;
            const ent = p.entitlements || {};
            return (
              <Card key={p.key} className={isCurrent ? "border-accent" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    {isCurrent && <Badge variant="outline">Current</Badge>}
                  </div>
                  <div className="text-3xl font-bold">
                    ${(p.monthly_price_cents / 100).toFixed(0)}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                  <CardDescription>
                    or ${(p.yearly_price_cents / 100).toFixed(0)}/yr
                  </CardDescription>
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
                        {ent[f.key] ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground/60" />
                        )}
                        <span>{f.label}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || !canManage}
                    onClick={() => toast.info("Checkout coming in the next step")}
                  >
                    {isCurrent ? "Current plan" : `Upgrade to ${p.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
