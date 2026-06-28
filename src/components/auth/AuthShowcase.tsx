import { motion } from "framer-motion";
import { Command, ShieldCheck, Zap } from "lucide-react";

interface Props {
  headline?: React.ReactNode;
  testimonial?: {
    quote: string;
    author: string;
    role: string;
    initials: string;
  };
}

const DEFAULT_TESTIMONIAL = {
  quote:
    "Qualixa replaced four separate QA tools. Our team finally has one source of truth for test cases, executions, and defects — and the AI catches gaps we used to miss.",
  author: "Lina Haddad",
  role: "Head of Quality, Northwind Cloud",
  initials: "LH",
};

export function AuthShowcase({
  headline = (
    <>
      The operating system for{" "}
      <span className="bg-gradient-to-r from-[#00cfe0] via-[#7dd3fc] to-[#a855f7] bg-clip-text text-transparent">
        modern quality teams.
      </span>
    </>
  ),
  testimonial = DEFAULT_TESTIMONIAL,
}: Props) {
  return (
    <div className="relative hidden lg:flex flex-col justify-center overflow-hidden bg-[#04070f]">
      {/* Grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,207,224,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,207,224,1) 1px,transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Glow orbs */}
      <div
        className="absolute -top-32 left-1/3 w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(0,207,224,0.18) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      <div
        className="absolute -bottom-40 -right-20 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(168,85,247,0.15) 0%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />
      {/* Constellation dots */}
      <svg className="absolute inset-0 w-full h-full opacity-40" aria-hidden>
        {Array.from({ length: 22 }).map((_, i) => {
          const x = (i * 137) % 100;
          const y = (i * 89) % 100;
          const r = (i % 3) + 1.2;
          const color = i % 3 === 0 ? "#a855f7" : i % 3 === 1 ? "#00cfe0" : "#f472b6";
          return (
            <circle
              key={i}
              cx={`${x}%`}
              cy={`${y}%`}
              r={r}
              fill={color}
              opacity={0.55}
            >
              <animate
                attributeName="opacity"
                values="0.2;0.9;0.2"
                dur={`${4 + (i % 5)}s`}
                repeatCount="indefinite"
              />
            </circle>
          );
        })}
      </svg>

      <div className="relative z-10 max-w-xl px-12 xl:px-16 py-10">
        {/* Brand mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-8"
          style={{
            background: "linear-gradient(135deg, rgba(0,207,224,0.18), rgba(168,85,247,0.18))",
            border: "1px solid rgba(0,207,224,0.35)",
            boxShadow: "0 0 30px rgba(0,207,224,0.25)",
          }}
        >
          <Command className="h-7 w-7 text-[#00cfe0]" />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-sans text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight text-[#e8f4f8]"
        >
          {headline}
        </motion.h2>

        {/* Testimonial card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-10 rounded-2xl border border-[rgba(0,207,224,0.18)] bg-[rgba(7,14,28,0.7)] backdrop-blur-md p-6 shadow-[0_20px_60px_-20px_rgba(0,207,224,0.25)]"
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="h-11 w-11 rounded-full flex items-center justify-center font-semibold text-sm"
              style={{
                background: "rgba(0,207,224,0.12)",
                color: "#00cfe0",
                border: "1px solid rgba(0,207,224,0.35)",
              }}
            >
              {testimonial.initials}
            </div>
            <div className="flex-1">
              <p className="font-sans text-sm font-semibold text-[#dde8f0] flex items-center gap-1.5">
                {testimonial.author}
                <span
                  className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-[#00cfe0] text-[#04070f] text-[9px]"
                  aria-label="Verified"
                >
                  ✓
                </span>
              </p>
              <p className="text-xs text-[#4a6a88]">{testimonial.role}</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-[#c0d0e0]">"{testimonial.quote}"</p>
        </motion.div>

        {/* Trust pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 flex items-center gap-3 flex-wrap"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(0,207,224,0.2)] bg-[rgba(0,207,224,0.06)] text-xs text-[#c0d0e0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
            99.9% Uptime
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(168,85,247,0.2)] bg-[rgba(168,85,247,0.06)] text-xs text-[#c0d0e0]">
            <ShieldCheck className="h-3 w-3 text-[#a855f7]" />
            SOC2 Aligned
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(244,114,182,0.2)] bg-[rgba(244,114,182,0.06)] text-xs text-[#c0d0e0]">
            <Zap className="h-3 w-3 text-[#f472b6]" />
            AI-native
          </span>
        </motion.div>
      </div>
    </div>
  );
}
