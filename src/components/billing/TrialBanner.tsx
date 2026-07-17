import { useEntitlements } from "@/hooks/useEntitlements";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { differenceInDays } from "date-fns";

export function TrialBanner() {
  const { subscription } = useEntitlements();
  const navigate = useNavigate();
  if (!subscription || subscription.status !== "trialing" || !subscription.trial_ends_at) return null;
  const end = new Date(subscription.trial_ends_at);
  if (end.getTime() < Date.now()) return null;
  const days = Math.max(0, differenceInDays(end, new Date()));
  return (
    <div className="border-b border-[hsl(187,92%,50%)/0.3] bg-gradient-to-r from-[hsl(187,92%,50%)/0.08] to-[hsl(262,83%,58%)/0.08] px-4 py-2 text-sm flex items-center gap-2">
      <Sparkles className="h-4 w-4 text-[hsl(187,92%,50%)] shrink-0" />
      <span className="flex-1">
        <strong>Pro trial</strong> — {days} day{days === 1 ? "" : "s"} left. No credit card required.
      </span>
      <button
        onClick={() => navigate("/billing")}
        className="underline text-[hsl(187,92%,50%)] hover:no-underline font-medium"
      >
        View plan
      </button>
    </div>
  );
}
