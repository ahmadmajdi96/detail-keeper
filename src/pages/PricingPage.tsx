import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/public/PublicShell";
import { Switch } from "@/components/ui/switch";
import { Check } from "lucide-react";

const FEATURE_LABELS: Record<string, string> = {
  sso: "SSO / SAML",
  audit_log: "Audit log",
  api_keys: "API keys",
  priority_support: "Priority support",
};

export default function PricingPage() {
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("monthly_price_cents");
      return data || [];
    },
  });

  const hasYearly = plans.some((p: any) => (p.yearly_price_cents ?? 0) > 0);

  return (
    <PublicShell>
      <div className="text-center mb-12">
        <div className="text-xs uppercase tracking-[0.25em] text-[hsl(187,92%,50%)] mb-3">Pricing</div>
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Choose your{" "}
          <span className="bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] bg-clip-text text-transparent">plan</span>
        </h1>
        <p className="text-white/60 max-w-xl mx-auto mb-8">
          Start free with a 14-day Pro trial. No credit card required. Cancel anytime.
        </p>
        {hasYearly && (
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm ${!yearly ? "text-white" : "text-white/40"}`}>Monthly</span>
            <Switch checked={yearly} onCheckedChange={setYearly} />
            <span className={`text-sm ${yearly ? "text-white" : "text-white/40"}`}>
              Yearly <span className="text-[hsl(187,92%,50%)]">(Save 20%)</span>
            </span>
          </div>
        )}
      </div>


      {isLoading ? (
        <div className="text-center text-white/50 py-16">Loading pricing…</div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((p: any) => {
            const ent = p.entitlements || {};
            const cents = yearly ? p.yearly_price_cents : p.monthly_price_cents;
            const isPopular = p.key === "individual_pro";

            return (
              <div
                key={p.key}
                className={`relative rounded-2xl p-8 border transition-all ${
                  isPopular
                    ? "border-[hsl(187,92%,50%)/0.5] bg-gradient-to-b from-[hsl(222,47%,10%)] to-[hsl(222,47%,6%)] shadow-[0_0_40px_-10px_hsl(187,92%,50%/0.3)]"
                    : "border-white/10 bg-[hsl(222,47%,8%)]"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-xs font-medium">
                    Most Popular
                  </div>
                )}
                <div className="text-xl font-bold mb-2">{p.name}</div>
                <div className="mb-6">
                  <span className="text-4xl font-bold">${(cents / 100).toFixed(0)}</span>
                  <span className="text-white/50 text-sm">{yearly ? " / yr" : " / mo"}</span>
                </div>
                <ul className="space-y-2 mb-6 text-sm">
                  <PlanLine>Seats: <strong>{ent.seats ?? "Unlimited"}</strong></PlanLine>
                  <PlanLine>Workspaces: <strong>{ent.max_workspaces ?? "Unlimited"}</strong></PlanLine>
                  <PlanLine>Projects: <strong>{ent.max_projects ?? "Unlimited"}</strong></PlanLine>
                  <PlanLine>AI jobs / mo: <strong>{ent.ai_jobs_per_month ?? "Unlimited"}</strong></PlanLine>
                  <PlanLine>Runner min / mo: <strong>{ent.runner_minutes_per_month ?? "Unlimited"}</strong></PlanLine>
                  {Object.entries(FEATURE_LABELS).map(([k, label]) =>
                    ent[k] ? <PlanLine key={k}>{label}</PlanLine> : null
                  )}
                </ul>
                <button
                  onClick={() => navigate("/register")}
                  className={`w-full py-3 rounded-lg font-medium text-sm transition-all ${
                    isPopular
                      ? "bg-gradient-to-r from-[hsl(187,92%,50%)] to-[hsl(262,83%,58%)] text-white hover:opacity-90"
                      : "border border-white/15 hover:bg-white/5"
                  }`}
                >
                  {p.key === "free" ? "Start free" : `Start ${p.name} trial`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-14 text-center text-sm text-white/50 max-w-2xl mx-auto space-y-3">
        <p>
          All prices are in USD and exclude any applicable sales tax or VAT, which is calculated at
          checkout. Paid plans renew automatically until cancelled; you can cancel at any time.
        </p>
        <p>
          Our order process is conducted by our online reseller <strong className="text-white/80">Paddle.com</strong>.
          Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer
          service inquiries and handles returns.
        </p>
        <p>
          See our <a href="/terms" className="underline hover:text-white">Terms &amp; Conditions</a>,{" "}
          <a href="/refunds" className="underline hover:text-white">Refund Policy</a> and{" "}
          <a href="/privacy" className="underline hover:text-white">Privacy Notice</a>.
        </p>
      </div>

    </PublicShell>
  );
}

function PlanLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="h-4 w-4 text-[hsl(187,92%,50%)] mt-0.5 shrink-0" />
      <span className="text-white/80">{children}</span>
    </li>
  );
}
