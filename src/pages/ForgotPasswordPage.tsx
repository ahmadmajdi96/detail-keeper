import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) return setError("Enter your email");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080f] px-6">
      <div className="w-full max-w-md">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-[#7a96b0] hover:text-[#00cfe0] mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <div className="flex items-center gap-2.5 mb-6">
          <Logo size={40} />
          <span className="font-semibold text-[#dde8f0] tracking-tight">Qualixa</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#e8f4f8] mb-1.5">Reset your password</h1>
        <p className="text-sm text-[#4a6a88] mb-6">We'll email you a link to set a new password.</p>

        {sent ? (
          <div className="rounded-lg bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.25)] px-4 py-4 text-sm text-[#a7f3d0] flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 mt-0.5" />
            <div>
              Check <span className="font-medium">{email}</span> for a reset link. It expires in 1 hour.
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-[rgba(255,48,88,0.08)] border border-[rgba(255,48,88,0.25)] px-4 py-3 text-sm text-[#ff7088]">
                {error}
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6a88]" />
              <input
                type="email" placeholder="name@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full h-11 pl-10 pr-3 rounded-lg bg-[#070e1c] border border-[rgba(0,207,224,0.15)] text-sm text-[#dde8f0] placeholder:text-[#2a4060] outline-none focus:border-[#00cfe0]"
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-[#04070f] disabled:opacity-70"
              style={{ background: "linear-gradient(135deg, #00cfe0, #38bdf8)" }}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
