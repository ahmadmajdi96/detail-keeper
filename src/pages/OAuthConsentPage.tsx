import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { supabaseOAuth } from "@/lib/oauth-consent";
import { Logo } from "@/components/Logo";
import { Loader2, ShieldCheck, X } from "lucide-react";

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await supabaseOAuth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = supabaseOAuth();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen bg-[#05080f] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-[rgba(0,207,224,0.15)] bg-[#070e1c] p-8 shadow-[0_20px_60px_-20px_rgba(0,207,224,0.35)]">
        <div className="flex items-center gap-2.5 mb-6">
          <Logo size={40} />
          <span className="font-semibold text-[#dde8f0] tracking-tight">Qualixa</span>
        </div>

        {error ? (
          <div className="text-sm text-[#ff7088]">
            Could not load this authorization request: {error}
          </div>
        ) : !details ? (
          <div className="flex items-center gap-2 text-sm text-[#7a96b0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading authorization…
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#00cfe0] mb-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Agent integration
            </div>
            <h1 className="text-xl font-semibold text-[#e8f4f8]">
              Connect {details.client?.name ?? "an app"} to Qualixa
            </h1>
            <p className="text-sm text-[#7a96b0] mt-2">
              This lets {details.client?.name ?? "the client"} use Qualixa as you — reading and
              filing test artifacts on your behalf.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 h-11 rounded-lg text-sm font-medium text-[#dde8f0] border border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <X className="h-4 w-4" /> Deny
              </button>
              <button
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 h-11 rounded-lg text-sm font-medium text-[#04070f] transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #00cfe0, #38bdf8)",
                  boxShadow: "0 8px 24px -8px rgba(0,207,224,0.6)",
                }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Approve
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
