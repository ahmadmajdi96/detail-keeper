import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { Logo } from "@/components/Logo";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import {
  Eye, EyeOff, Loader2, ArrowRight, Mail, Lock, User, Check,
} from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { register } = useAuth();
  const navigate = useNavigate();

  const reqs = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    { label: "Contains a special character", met: /[!@#$%^&*]/.test(password) },
  ];
  const strength = reqs.filter((r) => r.met).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setIsLoading(true);
    try {
      await register(email, name, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-[#05080f]">
      {/* LEFT */}
      <div className="relative flex flex-col px-6 sm:px-10 lg:px-16 py-8">
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
              Create your account
            </h1>
            <p className="text-sm text-[#4a6a88] mt-1.5">
              Spin up a workspace and start your 14-day free trial.
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
              <label htmlFor="name" className="text-xs font-medium text-[#7a96b0]">Full name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6a88]" />
                <input
                  id="name" type="text" placeholder="Jane Cooper"
                  value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-[#070e1c] border border-[rgba(0,207,224,0.15)] text-sm text-[#dde8f0] placeholder:text-[#2a4060] outline-none focus:border-[#00cfe0] focus:ring-2 focus:ring-[rgba(0,207,224,0.15)] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-[#7a96b0]">Work email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6a88]" />
                <input
                  id="email" type="email" placeholder="name@company.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading}
                  className="w-full h-11 pl-10 pr-3 rounded-lg bg-[#070e1c] border border-[rgba(0,207,224,0.15)] text-sm text-[#dde8f0] placeholder:text-[#2a4060] outline-none focus:border-[#00cfe0] focus:ring-2 focus:ring-[rgba(0,207,224,0.15)] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-[#7a96b0]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4a6a88]" />
                <input
                  id="password" type={showPassword ? "text" : "password"} placeholder="Create a password"
                  value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading}
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

              {/* Strength meter */}
              <div className="flex gap-1 mt-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all"
                    style={{
                      background:
                        i < strength
                          ? strength === 3
                            ? "#22c55e"
                            : strength === 2
                            ? "#eab308"
                            : "#f97316"
                          : "rgba(0,207,224,0.1)",
                    }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-1 mt-2">
                {reqs.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <Check className={`h-3 w-3 ${r.met ? "text-[#22c55e]" : "text-[#2a4060]"}`} />
                    <span className={r.met ? "text-[#c0d0e0]" : "text-[#4a6a88]"}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit" disabled={isLoading}
              className="w-full h-11 rounded-lg flex items-center justify-center gap-2 text-sm font-medium text-[#04070f] transition-all disabled:opacity-70"
              style={{
                background: "linear-gradient(135deg, #00cfe0, #38bdf8)",
                boxShadow: "0 8px 24px -8px rgba(0,207,224,0.6)",
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating account…
                </>
              ) : (
                <>
                  Create account <ArrowRight className="h-4 w-4" />
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
          <GoogleAuthButton label="Sign up with Google" />



          <p className="mt-10 text-center text-xs text-[#3a5870]">
            Already with us?{" "}
            <Link to="/login" className="text-[#00cfe0] hover:text-[#7dd3fc] font-medium">
              Log in
            </Link>
          </p>
        </motion.div>

        <p className="text-center text-[10px] text-[#2a4060]">
          By creating an account, you agree to our{" "}
          <a href="#" className="hover:text-[#4a6a88]">Terms</a> and{" "}
          <a href="#" className="hover:text-[#4a6a88]">Privacy Policy</a>.
        </p>
      </div>

      {/* RIGHT */}
      <AuthShowcase
        headline={
          <>
            Quality intelligence,{" "}
            <span className="bg-gradient-to-r from-[#00cfe0] via-[#7dd3fc] to-[#a855f7] bg-clip-text text-transparent">
              built for modern delivery teams.
            </span>
          </>
        }
      />
    </div>
  );
}
