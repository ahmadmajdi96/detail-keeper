import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { safeNext } from "@/lib/oauth-consent";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { Eye, EyeOff, Loader2, ArrowRight, Mail, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";

type Tab = "email" | "sso" | "magic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("email");

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = safeNext(searchParams.get("next"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setIsLoading(true);
    try {
      await login(email, password);
      if (nextPath) window.location.href = nextPath;
      else navigate("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Invalid credentials. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-[#05080f]">
      {/* LEFT: form */}
      <div className="relative flex flex-col px-6 sm:px-10 lg:px-16 py-8">
        {/* Brand */}
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <Logo size={48} />
            <span className="font-semibold text-[#dde8f0] tracking-tight">Qualixa</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 flex flex-col justify-center max-w-md w-full mx-auto"
        >
          <div className="mb-8">
            <h1 className="font-sans text-3xl font-semibold tracking-tight text-[#e8f4f8]">
              Welcome back
            </h1>
            <p className="text-sm text-[#4a6a88] mt-1.5">
              Enter your details to access your workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-[rgba(255,48,88,0.08)] border border-[rgba(255,48,88,0.25)] px-4 py-3 text-sm text-[#ff7088]"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-[#7a96b0]">
                Email or Workspace ID
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6a88]" />
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-[#070e1c] border border-[rgba(0,207,224,0.15)] text-sm text-[#dde8f0] placeholder:text-[#2a4060] outline-none focus:border-[#00cfe0] focus:ring-2 focus:ring-[rgba(0,207,224,0.15)] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-[#7a96b0]">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#00cfe0] hover:text-[#7dd3fc] transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6a88]" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full h-11 pl-10 pr-10 rounded-lg bg-[#070e1c] border border-[rgba(0,207,224,0.15)] text-sm text-[#dde8f0] placeholder:text-[#2a4060] outline-none focus:border-[#00cfe0] focus:ring-2 focus:ring-[rgba(0,207,224,0.15)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4a6a88] hover:text-[#00cfe0] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-[#04070f] transition-all disabled:opacity-70"
              style={{
                background: "linear-gradient(135deg, #00cfe0, #38bdf8)",
                boxShadow: "0 8px 24px -8px rgba(0,207,224,0.6)",
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Log In <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider + Google */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[rgba(0,207,224,0.12)]" />
            <span className="text-[10px] uppercase tracking-wider text-[#3a5870]">or</span>
            <div className="h-px flex-1 bg-[rgba(0,207,224,0.12)]" />
          </div>
          <GoogleAuthButton label="Continue with Google" nextPath={nextPath} />



          {/* Tabs */}
          <div className="mt-10 flex items-center justify-center gap-7 text-xs">
            {([
              ["email", "Email Login"],
              ["sso", "SSO"],
              ["magic", "Magic Link"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="relative pb-1.5 transition-colors"
                style={{ color: tab === k ? "#00cfe0" : "#4a6a88" }}
              >
                {label}
                {tab === k && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute left-0 right-0 -bottom-px h-[2px] bg-[#00cfe0] rounded-full"
                  />
                )}
              </button>
            ))}
          </div>

          {tab === "sso" && (
            <div className="mt-6">
              <SsoSignInBox nextPath={nextPath} />
            </div>
          )}
          {tab === "magic" && (
            <p className="mt-4 text-center text-xs text-[#4a6a88]">
              Magic link sign-in launching soon — use email for now.
            </p>
          )}

          <p className="mt-10 text-center text-xs text-[#3a5870]">
            New to Qualixa?{" "}
            <Link to="/register" className="text-[#f472b6] hover:text-[#f9a8d4] font-medium">
              Register
            </Link>
          </p>
        </motion.div>

        <p className="text-center text-[10px] text-[#2a4060]">
          By signing in, you agree to our{" "}
          <a href="#" className="hover:text-[#4a6a88]">Terms</a> and{" "}
          <a href="#" className="hover:text-[#4a6a88]">Privacy Policy</a>.
        </p>
      </div>

      {/* RIGHT: showcase */}
      <AuthShowcase />
    </div>
  );
}
