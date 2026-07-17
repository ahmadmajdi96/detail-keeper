import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Blocks the app until AAL2 is satisfied (for users with a verified TOTP factor) and enforces org require_mfa. */
export function MfaGate({ children }: { children: React.ReactNode }) {
  const { user, session, logout } = useAuth();
  const { currentOrganization } = useOrganization();
  const nav = useNavigate();
  const location = useLocation();

  const [checking, setChecking] = useState(true);
  const [need, setNeed] = useState<null | { kind: "aal2"; factorId: string } | { kind: "enroll" }>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!session || !user) { setChecking(false); setNeed(null); return; }
      // 1. Check AAL levels
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const { data: fa } = await supabase.auth.mfa.listFactors();
      const verified = ((fa?.all as any[]) || []).find((f) => f.status === "verified");
      if (cancelled) return;

      if (verified && aal?.currentLevel !== "aal2" && aal?.nextLevel === "aal2") {
        setNeed({ kind: "aal2", factorId: verified.id });
        setChecking(false);
        return;
      }
      // 2. Org policy: require MFA
      const requireMfa = !!(currentOrganization as any)?.require_mfa;
      if (requireMfa && !verified) {
        // owner exemption: don't lock the owner out
        const isOwner = currentOrganization?.owner_id === user.id;
        if (!isOwner) {
          setNeed({ kind: "enroll" });
          setChecking(false);
          return;
        }
      }
      setNeed(null);
      setChecking(false);
    }
    check();
    return () => { cancelled = true; };
  }, [session, user, currentOrganization]);

  async function verify() {
    if (!need || need.kind !== "aal2") return;
    setBusy(true);
    // Try recovery code path (contains a dash)
    if (code.includes("-")) {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) { setBusy(false); return; }
      const hash = await sha256Hex(code.trim());
      const { data: rows } = await supabase.from("mfa_recovery_codes")
        .select("id,used_at").eq("user_id", u.user.id).eq("code_hash", hash).maybeSingle();
      if (!rows || rows.used_at) { setBusy(false); return toast.error("Invalid or already-used recovery code"); }
      await supabase.from("mfa_recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", rows.id);
      // Recovery bypass: sign out to clear AAL requirement, force fresh login without TOTP factor removal is not possible client-side.
      // Best approach: unenroll factor so user can log back in without MFA (they've verified identity via recovery code).
      await supabase.auth.mfa.unenroll({ factorId: need.factorId });
      toast.success("Recovery code accepted — MFA disabled. Please re-enable it in Settings.");
      setBusy(false);
      setNeed(null);
      return;
    }
    const ch = await supabase.auth.mfa.challenge({ factorId: need.factorId });
    if (ch.error) { setBusy(false); return toast.error(ch.error.message); }
    const v = await supabase.auth.mfa.verify({ factorId: need.factorId, challengeId: ch.data.id, code });
    setBusy(false);
    if (v.error) return toast.error(v.error.message);
    toast.success("Verified");
    setNeed(null);
  }

  if (checking) return null;

  if (need?.kind === "aal2") {
    return (
      <div className="min-h-screen grid place-items-center p-4 bg-background">
        <Card className="w-full max-w-md border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Two-factor verification</CardTitle>
            <CardDescription>Enter the 6-digit code from your authenticator app, or a recovery code (with dash).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Code</Label>
              <Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456 or abcde-12345" />
            </div>
            <div className="flex gap-2">
              <Button onClick={verify} disabled={busy || code.length < 6} className="flex-1">
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Verify
              </Button>
              <Button variant="ghost" onClick={() => logout()}><LogOut className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (need?.kind === "enroll" && !location.pathname.startsWith("/settings")) {
    // Redirect to settings for enrollment
    setTimeout(() => nav("/settings?tab=security&enrollMfa=1"), 0);
    return (
      <div className="min-h-screen grid place-items-center p-4 bg-background">
        <Card className="w-full max-w-md border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />MFA required</CardTitle>
            <CardDescription>Your organization requires two-factor authentication. Redirecting to enrollment…</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
