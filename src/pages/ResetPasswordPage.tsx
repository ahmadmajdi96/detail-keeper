import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase auto-processes the recovery hash into a session on load.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also check current session (in case the event already fired)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords don't match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    setDone(true);
    setTimeout(() => navigate("/login"), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080f] px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2.5 mb-6">
          <Logo size={40} />
          <span className="font-semibold text-[#dde8f0] tracking-tight">Qualixa</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#e8f4f8] mb-1.5">Set a new password</h1>
        <p className="text-sm text-[#4a6a88] mb-6">Enter a new password for your account.</p>

        {done ? (
          <div className="rounded-lg bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] px-4 py-4 text-sm text-[#a7f3d0] flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
            <div>Password updated. Redirecting to sign in…</div>
          </div>
        ) : !ready ? (
          <div className="flex items-center gap-2 text-sm text-[#7a96b0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying reset link…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-[rgba(255,48,88,0.08)] border border-[rgba(255,48,88,0.25)] px-4 py-3 text-sm text-[#ff7088]">
                {error}
              </div>
            )}
            {[
              { label: "New password", value: password, set: setPassword },
              { label: "Confirm password", value: confirm, set: setConfirm },
            ].map((f) => (
              <div key={f.label} className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6a88]" />
                <input
                  type="password" placeholder={f.label}
                  value={f.value} onChange={(e) => f.set(e.target.value)}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-[#070e1c] border border-[rgba(0,207,224,0.15)] text-sm text-[#dde8f0] placeholder:text-[#2a4060] outline-none focus:border-[#00cfe0]"
                />
              </div>
            ))}
            <button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-[#04070f] disabled:opacity-70"
              style={{ background: "linear-gradient(135deg, #00cfe0, #38bdf8)" }}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</> : "Update password"}
            </button>
            <Link to="/login" className="block text-center text-xs text-[#7a96b0] hover:text-[#00cfe0]">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
