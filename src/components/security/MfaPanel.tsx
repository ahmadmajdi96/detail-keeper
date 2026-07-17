import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, Copy, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Factor = { id: string; friendly_name?: string | null; factor_type: string; status: string };

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function makeRecoveryCode() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  const s = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${s.slice(0, 5)}-${s.slice(5, 10)}`;
}

export function MfaPanel() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState<{ id: string; secret: string; uri: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const verified = factors.find((f) => f.status === "verified");

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) toast.error(error.message);
    setFactors(((data?.all as any) || []) as Factor[]);
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  async function beginEnroll() {
    setBusy(true);
    // Clean up any dangling unverified factors first
    for (const f of factors) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const uri: string = (data as any).totp.uri;
    const secret: string = (data as any).totp.secret;
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    setEnrolling({ id: data.id, secret, uri, qr });
    setCode("");
  }

  async function verifyEnroll() {
    if (!enrolling) return;
    setBusy(true);
    const ch = await supabase.auth.mfa.challenge({ factorId: enrolling.id });
    if (ch.error) { setBusy(false); return toast.error(ch.error.message); }
    const v = await supabase.auth.mfa.verify({ factorId: enrolling.id, challengeId: ch.data.id, code });
    if (v.error) { setBusy(false); return toast.error(v.error.message); }

    // Generate + store recovery codes (hashed)
    const codes = Array.from({ length: 10 }, makeRecoveryCode);
    const { data: u } = await supabase.auth.getUser();
    if (u?.user) {
      await supabase.from("mfa_recovery_codes").delete().eq("user_id", u.user.id);
      const rows = await Promise.all(codes.map(async (c) => ({ user_id: u.user!.id, code_hash: await sha256Hex(c) })));
      await supabase.from("mfa_recovery_codes").insert(rows);
    }
    setRecoveryCodes(codes);
    setEnrolling(null);
    setCode("");
    setBusy(false);
    toast.success("Two-factor authentication enabled");
    refresh();
  }

  async function cancelEnroll() {
    if (!enrolling) return;
    await supabase.auth.mfa.unenroll({ factorId: enrolling.id });
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function unenroll() {
    if (!verified) return;
    if (!code || code.length < 6) return toast.error("Enter your current 6-digit code to disable MFA");
    setBusy(true);
    const ch = await supabase.auth.mfa.challenge({ factorId: verified.id });
    if (ch.error) { setBusy(false); return toast.error(ch.error.message); }
    const v = await supabase.auth.mfa.verify({ factorId: verified.id, challengeId: ch.data.id, code });
    if (v.error) { setBusy(false); return toast.error(v.error.message); }
    const un = await supabase.auth.mfa.unenroll({ factorId: verified.id });
    setBusy(false);
    if (un.error) return toast.error(un.error.message);
    const { data: u } = await supabase.auth.getUser();
    if (u?.user) await supabase.from("mfa_recovery_codes").delete().eq("user_id", u.user.id);
    toast.success("MFA disabled");
    setCode("");
    refresh();
  }

  function copyCodes() {
    if (!recoveryCodes) return;
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />Two-Factor Authentication
          {verified && <Badge className="bg-success/10 text-success border-success/20">Enabled</Badge>}
        </CardTitle>
        <CardDescription>Protect your account with a TOTP authenticator app (Google Authenticator, 1Password, etc.).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : recoveryCodes ? (
          <div className="space-y-3">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Save these one-time recovery codes somewhere safe. Each can be used once if you lose access to your authenticator app.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border/50 p-4 font-mono text-sm">
              {recoveryCodes.map((c) => <div key={c}>{c}</div>)}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={copyCodes}>{copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}Copy</Button>
              <Button onClick={() => setRecoveryCodes(null)}>I've saved them</Button>
            </div>
          </div>
        ) : enrolling ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <img src={enrolling.qr} alt="MFA QR" className="rounded-md border border-border/50 bg-white p-2" />
              <div className="space-y-2 text-sm">
                <p>Scan this QR with your authenticator app, or enter the secret manually:</p>
                <div className="font-mono bg-muted p-2 rounded break-all text-xs">{enrolling.secret}</div>
              </div>
            </div>
            <div className="space-y-2 max-w-xs">
              <Label>Verification code</Label>
              <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
            </div>
            <div className="flex gap-2">
              <Button onClick={verifyEnroll} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Verify & activate
              </Button>
              <Button variant="ghost" onClick={cancelEnroll} disabled={busy}>Cancel</Button>
            </div>
          </div>
        ) : verified ? (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              MFA is active on this account. To disable it, enter a current 6-digit code from your authenticator app.
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label>Current code</Label>
                <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="w-40" />
              </div>
              <Button variant="outline" className="text-destructive" onClick={unenroll} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Disable MFA
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={beginEnroll} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}Enable MFA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
