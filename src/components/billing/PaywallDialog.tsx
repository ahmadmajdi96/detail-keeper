import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feature?: string;
  plan?: string;
  limit?: number | null;
  used?: number;
}

export function PaywallDialog({ open, onOpenChange, feature, plan = "Free", limit, used }: Props) {
  const navigate = useNavigate();
  const label = feature
    ? feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "this feature";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-accent" /> Upgrade required
          </DialogTitle>
          <DialogDescription>
            You've hit your <strong>{plan}</strong> plan limit for <strong>{label}</strong>
            {limit != null ? ` (${used ?? "—"} / ${limit})` : ""}. Upgrade to keep going.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Not now</Button>
          <Button onClick={() => { onOpenChange(false); navigate("/billing"); }}>
            View plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
