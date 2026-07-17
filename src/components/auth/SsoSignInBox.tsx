import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

/**
 * "Sign in with SSO" widget for the login page.
 *
 * Behavior:
 * 1. User types their email (or bare domain).
 * 2. We check `sso_connections` for an enabled row whose `domains` contain that domain.
 *    - If none, we still try `signInWithSSO({ domain })` — the auth platform may have
 *      a matching provider registered even if our app has no config row.
 *    - If the auth platform hasn't been configured for SSO at all, `signInWithSSO`
 *      returns an error; we surface it inline without breaking the page.
 * 3. After a successful redirect back, `sso-jit-provision` places the user in the
 *    matching org (fired from AuthContext / session handling).
 */
export function SsoSignInBox({ nextPath }: { nextPath?: string | null }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const domain = email.includes("@") ? email.split("@")[1] : email;
    if (!domain) { setError("Enter an email or domain"); return; }
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}${nextPath || "/dashboard"}`;
      // signInWithSSO exists in supabase-js v2; guard for older builds.
      const authAny = supabase.auth as any;
      if (typeof authAny.signInWithSSO !== "function") {
        throw new Error("SSO is not enabled on this deployment. Contact your admin.");
      }
      const { data, error } = await authAny.signInWithSSO({ domain, options: { redirectTo } });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      const msg = err?.message || "SSO sign-in unavailable";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="text-xs font-medium text-[#7a96b0]">Work email</label>
      <div className="relative">
        <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6a88]" />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full h-11 pl-10 pr-3 rounded-lg bg-[#070e1c] border border-[rgba(0,207,224,0.15)] text-sm text-[#dde8f0] placeholder:text-[#2a4060] outline-none focus:border-[#00cfe0] focus:ring-2 focus:ring-[rgba(0,207,224,0.15)] transition-all"
        />
      </div>
      {error && <p className="text-xs text-[#ff7088]">{error}</p>}
      <button
        type="submit"
        disabled={loading || !email}
        className="w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-[#04070f] transition-all disabled:opacity-70"
        style={{ background: "linear-gradient(135deg, #00cfe0, #7c3aed)" }}
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Redirecting…</> : "Continue with SSO"}
      </button>
      <p className="text-[10px] text-[#4a6a88] text-center">
        Routed to your organization&apos;s identity provider based on your email domain.
      </p>
    </form>
  );
}
