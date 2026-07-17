import { useEntitlements } from "@/hooks/useEntitlements";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

export function DunningBanner() {
  const { subscription } = useEntitlements();
  const navigate = useNavigate();
  if (subscription?.status !== "past_due") return null;
  return (
    <div className="bg-destructive/10 border-b border-destructive/40 text-destructive px-4 py-2 text-sm flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Your subscription payment is past due. Update your payment method to keep your plan active.
      </span>
      <button
        onClick={() => navigate("/billing")}
        className="underline font-medium hover:no-underline"
      >
        Manage billing
      </button>
    </div>
  );
}
